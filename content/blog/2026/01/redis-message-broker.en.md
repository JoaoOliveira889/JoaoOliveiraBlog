---
title: Redis Implementing Pub/Sub and Streams in .NET 10
date: '2026-01-15T00:00:00-00:00'
description: A practical guide to using Redis as a message broker with Pub/Sub and Streams in .NET 10. Learn when to choose real-time messaging versus durable, persistent event processing through hands-on examples.
tags:
  - redis
  - dotnet
  - message-broker
  - pubsub
  - streams
  - event-driven
  - backend
draft: false
---

![Article cover](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc178-a9f4-7904-b087-39a5b0377163.webp)

Redis (Remote Dictionary Server) can do much more than just act as a cache. I know that this is the most common use case because it protects your database from excessive requests and improves response times by keeping data in memory, but Redis offers much more.

Redis can also working as a powerful **message broker**. With native support for **Pub/Sub** and **Streams**, if you already have an instance of Redis running, you may want to take a look at other features that can do your job better.

In this article, I'll demonstrate how to implement both Pub/Sub and Streams as message brokers using Redis and .NET. By the end, you should be able to evaluate which approach is the best option for your specific scenario.

## Concepts: Pub/Sub vs Stream

Think of **Pub/Sub** like a live Radio Broadcast. If your radio is off, you miss the song. **Streams**, on the other hand, are more like YouTube. You can watch the video whenever you want, and it remains available until it is deleted. Below is a comparison between the

| Feature     | Pub/Sub                                      | Streams                                         |
| ----------- | -------------------------------------------- | ----------------------------------------------- |
| Persistence | No. Messages are lost if no one is listening | Yes. Messages are stored in Redis until deleted |
| Delivery    | One-to-Many                                  | Many-to-Many                                    |
| History     | No                                           | Yes. You can read "past" messages               |
| Use Case    | Real-time chats, notifications               | Order processing, Audit logs, Event Sourcing    |

## Environment Configuration

We’ll build this project with .NET 10. First, create a Minimal API project from the terminal:

```bash
# 1. Create project folder
mkdir RedisMessageLab && cd RedisMessageLab

# 2. Create Minimal API project
dotnet new webapi -n MessagingApi -minimal

# 3. Add the Redis Driver
cd MessagingApi
dotnet add package StackExchange.Redis

# 4. Create the Docker Compose file in the root
cd ..
touch docker-compose.yml
```

### Docker Setup

Create a `docker-compose.yml` file and add the following configuration:

```yaml
services:
  redis:
    image: redis:7.4-alpine
    container_name: redis-lab
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes"] # Enable persistence for Streams
```

Start the container with:

```bash
docker-compose up -d
```

## Project Implementation

### Model

Create an `AppMessage` record to pass data through our system.

```csharp
public record AppMessage(string Id, string Content, string Sender);
```

### Interface

Create an `IRedisService` interface.

```csharp
public interface IRedisService 
{
    Task<long> PublishAsync(AppMessage message);
    Task AppendAsync(AppMessage message);
    Task<AppMessage?> ConsumeAndStackDeleteAsync();
    Task<List<AppMessage>> PeekHistoryAsync();
}
```

### Service

Create a `RedisService` class.

```csharp
public class RedisService(IConnectionMultiplexer redis) : IRedisService
{
    private const string Channel = "live_updates";
    private const string Stream = "audit_stream";

    public async Task<long> PublishAsync(AppMessage message)
    {
        var sub = redis.GetSubscriber();
        string json = JsonSerializer.Serialize(message);
    
        // Publish returns the count of active subscribers
        long subscribersCount = await sub.PublishAsync(RedisChannel.Literal(Channel), json);

        if (subscribersCount != 0) return subscribersCount;
        
        // This will show up in your .NET Terminal/Console
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine($"[PUB/SUB WARNING] Message {message.Id} was sent, but 0 subscribers were listening. Data is lost!");
        Console.ResetColor();

        return subscribersCount;
    }

    public async Task AppendAsync(AppMessage message)
    {
        var db = redis.GetDatabase();
        await db.StreamAddAsync(Stream, [
            new NameValueEntry("id", message.Id), 
            new NameValueEntry("content", message.Content)]);
    }

    public async Task<AppMessage?> ConsumeAndStackDeleteAsync()
    {
        var db = redis.GetDatabase();
        // Read the oldest message
        var messages = await db.StreamReadAsync(Stream, "0-0", count: 1);
        if (messages.Length == 0) return null;

        var msg = messages.First();
        var note = new AppMessage(msg.Values[0].Value!, msg.Values[1].Value!, "Stream");

        // ANSWERING YOUR DOUBT: Delete after consuming
        await db.StreamDeleteAsync(Stream, [msg.Id]);
        return note;
    }

    public async Task<List<AppMessage>> PeekHistoryAsync()
    {
        var db = redis.GetDatabase();

        // XRANGE audit_stream - + (Read everything from start to finish)
        var entries = await db.StreamRangeAsync(Stream, "-", "+");

        return entries.Select(e => new AppMessage(
            e.Values.FirstOrDefault(v => v.Name == "id").Value!,
            e.Values.FirstOrDefault(v => v.Name == "content").Value!,
            "Stream History"
        )).ToList();
    }
}
```

## Workers

Create a `LiveNotificationWorker` worker to handle live notifications.

```csharp
public class LiveNotificationWorker : BackgroundService 
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
        var redis = await ConnectionMultiplexer.ConnectAsync("localhost:6379");
        var sub = redis.GetSubscriber();

        await sub.SubscribeAsync(RedisChannel.Literal("live_updates"), (channel, message) => {
            // This proves Pub/Sub success in the logs
            Console.WriteLine($"[PUB/SUB SUCCESS] Received Live: {message}");
        });
    }
}
```

## Program.cs

Open `Program.cs` and add the code below.

```csharp
var builder = WebApplication.CreateBuilder(args);
var multiplexer = ConnectionMultiplexer.Connect("localhost:6379");
builder.Services.AddSingleton<IConnectionMultiplexer>(multiplexer);
builder.Services.AddScoped<IRedisService, RedisService>();
builder.Services.AddHostedService<LiveNotificationWorker>();

var app = builder.Build();

// Endpoint 1: Test Pub/Sub
app.MapPost("/broadcast", async (AppMessage message, IRedisService service) => {
    long listeners = await service.PublishAsync(message);
    return Results.Ok(new { 
        Mechanism = "Pub/Sub", 
        ActiveListeners = listeners,
        Status = listeners > 0 ? "Delivered" : "Lost (No Listeners)"
    });
});

// Endpoint 2: Test Stream Storage
app.MapPost("/log", async (AppMessage message, IRedisService service) => {
    await service.AppendAsync(message);
    return Results.Ok("Message logged in Stream.");
});

// Endpoint 3: Test Stream Consume & Delete
app.MapPost("/log/process", async (IRedisService service) => {
    var note = await service.ConsumeAndStackDeleteAsync();
    return note is null ? Results.NotFound("No logs left.") : Results.Ok(note);
});

// Endpoint 4: Peek at History (Without deleting)
app.MapGet("/log/history", async (IRedisService service) =>
{
    var history = await service.PeekHistoryAsync();
    return history.Count != 0 ? Results.Ok(history) : Results.NotFound("The Stream is empty.");
});

app.Run();
```

## Comparison

| Feature       | Pub/Sub Success               | Stream Success                      |
| ------------- | ----------------------------- | ----------------------------------- |
| Data Delivery | Instant, only to active users | Stored, can be claimed later        |
| Cleanup       | Automatic (nothing is stored) | Manual (you must `XDEL` or `XTRIM`) |
| Guarantee     | None                          | At-least-once                       |

## Testing the endpoints

I'll use the [Apidog](https://app.apidog.com/invite/user?token=E9PfYpmFcGrvv5zB2K0Gj) to test the endpoints, but you can use your preferred tool.

Run the project from the terminal with:

```bash
dotnet run
```

The project should then be running at `http://localhost:5040`

### Pub/Sub Broadcast

This endpoint sends a message that the background worker should receive instantly in the terminal.

- Method: `POST`
- Endpoint: `/broadcast`

Body (JSON)

```json
{
    "id": "PS-100",
    "content": "Live alert: System update at 10 PM",
    "sender": "AdminPanel"
}
```

In Apidog, you will see the message`"Message broadcasted. Check terminal for success."` and in the terminal you should see the message as shown in the image below.
![Terminal from the brodcast endpoint](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc182-4018-7df8-abff-df8e07c74240.webp)

#### Simulate a Pub/Sub without Worker

If you want to simulate a scenario where no worker is running, follow these steps:

1. Comment out this line in `Program.cs`:
`builder.Services.AddHostedService<LiveNotificationWorker>();`
2. Send a request to `/broadcast`.
3. The API returns `200 OK`, but the message is gone forever. You will not see the success message in the terminal, as you did in the previous test.

![Terminal no worker](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc183-a24b-7e0f-861a-9cb05163e48f.webp)

### Stream Log

This endpoint sends a message to a Redis Stream, where it will remain until you manually process it.

- Method: `POST`
- Endpoint: `/log`

Body (JSON)

```json
{
    "id": "STR-500",
    "content": "CRITICAL: Database connection retry",
    "sender": "DB-Monitor"
}
```

If the message is published successfully, you will see in the response `"Message logged in Stream."`

> Note: You can send multiple messages; just change something in the body to better illustrate the test.

### Peak History on Stream

With this endpoint, you can retrieve all messages published to the Stream that have not been consumed.

- Method: `GET`
- Endpoint: `/log/history`
- Body: None

You will see all published messages in the response:

![Response history](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc185-93f6-7231-a6b6-063478d40644.webp)

### Stream Process

This request fetches the oldest message from the stream and then deletes it from Redis.

- Method: `POST`
- Endpoint: `/log/process`
- Body: None

1. The first time you click **Send**, you will receive the JSON for STR-500.
2. The second time you click **Send**, if you have not sent any additional messages, you will receive a `404 Not Found` response (because the message was deleted after the first consumption). If you send more messages to the `/log` endpoint, you must consume all of them before receiving a `404`, which indicates that the stream is empty.

![Stream response](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc187-5006-752d-adb8-53438e992a36.webp)

To view the stored messages in the terminal, you can use the following command:

```bash
docker exec -it redis-lab redis-cli XRANGE audit_stream - +
```

## Process Flow

The diagram illustrates the fundamental difference between **Redis Pub/Sub** and **Redis Streams** in terms of message delivery and persistence.

![Diagram](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc188-b411-778c-9a5f-733ffcb81ec0.webp)

## Conclusion

As shown throughout this article, Redis is a solid option for use as message broker, especially when response time is critical for your application, or when you already have a Redis instance running and do not want to introduce an additional messaging tool.

You can choose **Pub/Sub** when you need to build features such as a live chat, a gaming lobby, or a proximity-based matching system. If your application requires monitoring active users or real-time updates, and occasional message loss is acceptable, Pub/Sub is a good fit. It is fast, lightweight, and does not consume memory by storing messages.

On the other hand, when message retention is critical and you cannot afford to lose data, such as in payment flows or order processing. **Streams** are the better choice. Messages are persisted, ordered, and can be processed later, even if consumers are temporarily unavailable.

In short, Pub/Sub is about speed and immediacy, while Streams focus on durability and control.

## Project Source Code

You can find the complete implementation of this project on my [GitHub](https://github.com/JoaoOliveira889/RedisMessageBroker)

## References & Further Reading

[Redis Documentation: Pub/Sub](https://redis.io/docs/latest/develop/pubsub/) – Official guide on the publish/subscribe messaging paradigm.

[Redis Documentation: Streams](https://redis.io/docs/latest/develop/data-types/streams/) – Deep dive into the stream data type and consumer groups.

[StackExchange.Redis GitHub](https://github.com/StackExchange/StackExchange.Redis) – Documentation for the leading .NET Redis client used in this project.

[Microsoft Docs: Minimal APIs Overview ](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis?view=aspnetcore-10.0)– Reference for building high-performance APIs with .NET 10.

[Docker Docs: Compose File Reference](https://docs.docker.com/reference/compose-file/) – Guide for setting up multi-container applications.
