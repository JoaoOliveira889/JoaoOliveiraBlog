---
title: Redis Implementando Pub/Sub e Streams em .NET 10
date: '2026-01-09T00:00:00-00:00'
description: Um guia prático sobre como utilizar o Redis como message broker com Pub/Sub e Streams em .NET 10.Aprenda quando optar por mensagens em tempo real ou por processamento de eventos durável e persistente, por meio de exemplos práticos.
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

Redis (Remote Dictionary Server) pode fazer muito mais do que apenas atuar como um cache. Eu sei que esse é o caso de uso mais comum, já que ele protege o banco de dados contra requisições excessivas e melhora o tempo de resposta ao manter os dados em memória, mas o Redis oferece muito mais do que isso.

O Redis também pode funcionar como um poderoso **message broker**. Com suporte nativo a **Pub/Sub** e **Streams**, se você já possui uma instância do Redis em execução, pode valer a pena explorar esses outros recursos para atender melhor às necessidades da sua aplicação.

Neste artigo, vou demonstrar como implementar tanto Pub/Sub quanto Streams como message brokers utilizando Redis e .NET. Ao final, você será capaz de avaliar qual abordagem é a melhor opção para o seu cenário específico.

## Conceitos: Pub/Sub vs Streams

Pense no **Pub/Sub** como uma transmissão de rádio ao vivo. Se o seu rádio estiver desligado, você perde a música. **Streams**, por outro lado, são mais parecidos com o YouTube. Você pode assistir ao vídeo quando quiser, e ele permanece disponível até ser deletado. Abaixo está uma comparação entre os dois.

| Recurso      | Pub/Sub                                      | Streams                                         |
| -------------| -------------------------------------------- | ----------------------------------------------- |
| Persistência | Não. As mensagens são perdidas se ninguém estiver ouvindo | Sim. As mensagens são armazenadas no Redis até serem deletadas |
| Entrega      | Um-para-muitos                               | Muitos-para-muitos                              |
| Histórico    | Não                                          | Sim. É possível ler mensagens “antigas”         |
| Caso de uso  | Chats em tempo real, notificações            | Processamento de pedidos, logs de auditoria, event sourcing |

## Configuração do Ambiente

Vamos construir este projeto com .NET 10. Primeiro, crie um projeto de Minimal API a partir do terminal:

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

### Configuração do Docker

Crie um arquivo `docker-compose.yml` e adicione a seguinte configuração:

```yaml
services:
  redis:
    image: redis:7.4-alpine
    container_name: redis-lab
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes"] # Enable persistence for Streams
```

Inicie o container com:

```bash
docker-compose up -d
```

## Implementação do Projeto

### Model

Crie um record `AppMessage` para transportar dados pelo nosso sistema.

```csharp
public record AppMessage(string Id, string Content, string Sender);
```

### Interface

Crie uma interface `IRedisService`.

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

Crie a `RedisService` class.

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

Crie um worker `LiveNotificationWorker` para lidar com notificações em tempo real.

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

Abra o `Program.cs` e adicione o código abaixo.

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

## Comparação

| Recurso          | Sucesso com Pub/Sub                 | Sucesso com Streams                          |
| ---------------- | ----------------------------------- | -------------------------------------------- |
| Entrega de dados | Instantânea, apenas para usuários ativos | Armazenada, pode ser processada depois       |
| Limpeza          | Automática (nada é armazenado)      | Manual (você deve usar `XDEL` ou `XTRIM`)    |
| Garantia         | Nenhuma                             | Pelo menos uma vez (at-least-once)           |

## Testando os endpoints

Vou usar o [Apidog](https://app.apidog.com/invite/user?token=E9PfYpmFcGrvv5zB2K0Gj) para testar os endpoints, mas você pode usar a ferramenta de sua preferência.

Execute o projeto a partir do terminal com:

```bash
dotnet run
```

O projeto deverá estar em execução em `http://localhost:5040`.

### Pub/Sub Broadcast

Este endpoint envia uma mensagem que o worker em background deve receber instantaneamente no terminal.

- Método: `POST`
- Endpoint: `/broadcast`

Body (JSON)

```json
{
    "id": "PS-100",
    "content": "Live alert: System update at 10 PM",
    "sender": "AdminPanel"
}
```

No Apidog, você verá a mensagem `"Message broadcasted. Check terminal for success."` e, no terminal, deverá ver a mensagem conforme mostrado na imagem abaixo.
![Terminal from the brodcast endpoint](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc182-4018-7df8-abff-df8e07c74240.webp)

#### Simular Pub/Sub sem Worker

Se você quiser simular um cenário em que nenhum worker está em execução, siga estes passos:

1. Comente esta linha no `Program.cs`:
   `builder.Services.AddHostedService<LiveNotificationWorker>();`
2. Envie uma requisição para `/broadcast`.
3. A API retorna `200 OK`, mas a mensagem é perdida para sempre. Você não verá a mensagem de sucesso no terminal, como aconteceu no teste anterior.

![Terminal no worker](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc183-a24b-7e0f-861a-9cb05163e48f.webp)

### Stream Log

Este endpoint envia uma mensagem para um Redis Stream, onde ela permanecerá até que você a processe manualmente.

- Método: `POST`
- Endpoint: `/log`

Body (JSON)

```json
{
    "id": "STR-500",
    "content": "CRITICAL: Database connection retry",
    "sender": "DB-Monitor"
}
```

Se a mensagem for publicada com sucesso, você verá na resposta `"Message logged in Stream."`

> **Nota:** Você pode enviar múltiplas mensagens; basta alterar algum campo no body para ilustrar melhor o teste.

### Peek History on Stream

Com este endpoint, você pode recuperar todas as mensagens publicadas no Stream que ainda não foram consumidas.

- Método: `GET`
- Endpoint: `/log/history`
- Body: Nenhum

Você verá todas as mensagens publicadas na resposta:

![Response history](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc185-93f6-7231-a6b6-063478d40644.webp)

### Stream Process

Esta requisição busca a mensagem mais antiga do stream e, em seguida, a remove do Redis.

- Método: `POST`
- Endpoint: `/log/process`
- Body: Nenhum

1. Na primeira vez que você clicar em **Send**, receberá o JSON referente à mensagem `STR-500`.
2. Na segunda vez que você clicar em **Send**, se nenhuma mensagem adicional tiver sido enviada, você receberá uma resposta `404 Not Found` (pois a mensagem foi removida após o primeiro consumo). Caso você envie mais mensagens para o endpoint `/log`, será necessário consumir todas elas antes de receber o `404`, o que indica que o stream está vazio.

![Stream response](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc187-5006-752d-adb8-53438e992a36.webp)

Para visualizar as mensagens armazenadas no terminal, você pode usar o seguinte comando:

```bash
docker exec -it redis-lab redis-cli XRANGE audit_stream - +
```

## Fluxo do Processo

O diagrama ilustra a diferença fundamental entre Redis Pub/Sub e Redis Streams em termos de entrega e persistência de mensagens.

![Diagram](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc188-b411-778c-9a5f-733ffcb81ec0.webp)

## Conclusão

Como demonstrado ao longo deste artigo, o Redis é uma opção sólida para ser utilizado como message broker, especialmente quando o tempo de resposta é crítico para a sua aplicação ou quando você já possui uma instância do Redis em execução e não quer introduzir uma ferramenta adicional de mensageria.

Você pode escolher **Pub/Sub** quando precisar construir funcionalidades como um chat em tempo real, um lobby de jogos ou um sistema de matching por proximidade. Se a sua aplicação exige monitoramento de usuários ativos ou atualizações em tempo real, e a perda ocasional de mensagens é aceitável, o Pub/Sub é uma boa escolha. Ele é rápido, leve e não consome memória armazenando mensagens.

Por outro lado, quando a retenção de mensagens é crítica e você não pode se dar ao luxo de perder dados — como em fluxos de pagamento ou processamento de pedidos — **Streams** são a melhor opção. As mensagens são persistidas, ordenadas e podem ser processadas posteriormente, mesmo que os consumidores estejam temporariamente indisponíveis.

Em resumo, Pub/Sub é sobre velocidade e imediatismo, enquanto Streams focam em durabilidade e controle.

## Código-Fonte do Projeto

Você pode encontrar a implementação completa deste projeto no meu [GitHub](https://github.com/JoaoOliveira889/RedisMessageBroker)

## Referências e Leitura Complementar

[Redis Documentation: Pub/Sub](https://redis.io/docs/latest/develop/pubsub/) – Guia oficial sobre o paradigma de mensageria publish/subscribe.

[Redis Documentation: Streams](https://redis.io/docs/latest/develop/data-types/streams/) – Análise detalhada do tipo de dado Stream e de consumer groups.

[StackExchange.Redis GitHub](https://github.com/StackExchange/StackExchange.Redis) – Documentação do principal cliente Redis para .NET utilizado neste projeto.

[Microsoft Docs: Minimal APIs Overview](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis?view=aspnetcore-10.0) – Referência para a criação de APIs de alta performance com .NET 10.

[Docker Docs: Compose File Reference](https://docs.docker.com/reference/compose-file/) – Guia para configurar aplicações com múltiplos containers.
