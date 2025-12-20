---
title: Enrich Logs with CorrelationID in .NET
date: '2025-10-13T15:20:00-02:00'
tags:
- net
- log
- correlationid
draft: false
---
A Correlation ID is a good technique when you need to track a log journey in your system. This is especially true when a single user request spans **multiple services and layers** in your architecture. For example, when your log is added across these various components, and you need to track the entire log lifecycle, it is very difficult and painful if you don't have a way to track it by a common value.

This is where the Correlation ID comes in to make your life better. This technique will automatically add a unique identifier to all your logs that you can use in our preferred analytic tool to view the entire sequence of events, even when the request is propagated to other internal services. This provides an easy way to filter and display only what you need to know, providing **end to end traceability**.

In .NET, we have an easy way to implement this, allowing us to create a unique identifier in all logs that we can use for a single track. In this article, I'll show you how to do it using the native `ILogger` in .NET, and how to ensure this ID travels with your outbound HTTP requests.

So, let's build it together.

---

## Create a Middleware

The first step is to create a middleware with a default configuration to include the Correlation ID in each logger. To make it unique, we will use a GUID (Globally Unique Identifier) to generate a unique identifier. This middleware is responsible for receiving and establishing the trace ID for the current service.

```csharp
public sealed class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        string correlationId =
            context.Request.Headers.TryGetValue(CorrelationIdConstants.HeaderName, out var headerValue)
            && !string.IsNullOrWhiteSpace(headerValue)
                ? headerValue.ToString()
                : Guid.NewGuid().ToString();

        context.Items[CorrelationIdConstants.LogPropertyName] = correlationId;
        context.Response.Headers[CorrelationIdConstants.HeaderName] = correlationId;

        using (logger.BeginScope(new { CorrelationId = correlationId }))
        {
            await next(context);
        }
    }
}
```

This middleware does several important things:

- **Retrieval and Generation**: It checks the incoming HTTP headers for an existing Correlation ID. If found (meaning the request came from another service), it reuses it. If not found, **it generates a new unique GUID**.
- **Response Header**: It adds the Correlation ID to the outgoing response headers so the client or next service can use it for tracing.
- **Context Storage**: It stores the ID in `context.Items`. This is the key piece that will allow us to access the ID for outbound propagation later.
- **Logging Scope**: It uses `logger.BeginScope()` to link the Correlation ID to the current request's entire logging lifecycle. This ensures every subsequent log entry (`ILogger`) automatically includes the ID.
- **Pipeline Execution**: It calls `await next(context)` to process the request, and thanks to the `using` block, the log scope is automatically cleaned up when the request is finished.

## Defining Correlation ID Constants

To keep your project clean and follow best practices, let's create a file to add our constant values. By defining these values in a static class, we avoid "magic strings" and prevent potential runtime errors caused by typos, ensuring consistency across all components.

Create a static class named `CorrelationIdConstants`:

```csharp
public static class CorrelationIdConstants
{
    public const string HeaderName = "X-Correlation-ID";
    public const string LogPropertyName = "CorrelationId";
}
```

Purpose of the Constants

- **HeaderName**: Defines the specific HTTP header key that our middleware will look for in incoming requests and use to stamp outgoing responses.
- **LogPropertyName**: Defines the property name that will appear in your log output.

## Registering the Middleware

To use this middleware, you need to register it in your `Program.cs` file. This is the application's entry point where the request pipeline is configured.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi(); 

var app = builder.Build();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseHttpsRedirection();
app.MapControllers();

app.Run();
```

**NOTE:** It's **critical** to register this middleware early in the pipeline, to ensure the Correlation ID is established and available for all subsequent Middleware, Filters, and Controllers that handle the request.

## Configure appsettings.json for Console Visibility

To ensure the Correlation ID is visible in your console logs, you must explicitly instruct the default console logging provider to include log scopes.

```json
 {
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning",
      "Microsoft.EntityFrameworkCore": "Warning"
    },
    "Console": {
      "IncludeScopes": true
    }
  }
}
```

**NOTE**: The line `IncludeScopes: true` is needed to show in the .NET Console Logger, this is crucial for developers relying on the console during local development and testings.

However, if you were using a structured logging provider like **Serilog** or **NLog**, or sending logs to a specialized tool like **Splunk**, **Kibana** or **Elastic**, this setting is often not required. Those systems usually capture data automatically or use custom configurations to capture scope data or use custom configurations to include the properties directly.

## Propagating the Correlation ID to External Services

When making HTTP requests to external services, we need to create a custom `DelegatingHandler` paired with the `HttpClientFactory`. This pattern allows us to intercept every outbound request made by a specific `HttpClient` and inject the `CorrelationId`header, ensuring our log trace is continuous across service boundaries.

1. The `CorrelationIdDelegatingHandler` Implementation
This handler uses the injected `IHttpContextAccessor` to retrieve the active Correlation ID set by our inbound middleware and adds it to the outbound request headers.

``` csharp
public class CorrelationIdDelegatingHandler(IHttpContextAccessor httpContextAccessor) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var httpContext = httpContextAccessor.HttpContext;
        
        if (httpContext == null ||
            !httpContext.Items.TryGetValue(CorrelationIdConstants.LogPropertyName, out object? correlationIdObject))
            return await base.SendAsync(request, cancellationToken);
            
        string? correlationId = correlationIdObject.ToString();
        request.Headers.TryAddWithoutValidation(CorrelationIdConstants.HeaderName, correlationId);
        
        return await base.SendAsync(request, cancellationToken);
    }
}
```

2. Creating the Generic HTTP Client Service

The `HttpClientService` is designed to be your reusable client. It takes the array of `DelegatingHandler` services resolved by DI and manually chains them together with a base transport handler (`SocketsHttpHandler`) to create a correctly configured `HttpClient`.

```csharp
public class HttpClientService(IHttpClientFactory httpClientFactory, DelegatingHandler[] handlers)
    : IHttpClientService
{
    public Task<HttpResponseMessage> CallServiceAsync(
        string baseUrl, string authKey, HttpMethod method, string endpoint)
    {
        HttpMessageHandler currentHandler = new SocketsHttpHandler(); 
        
        foreach (var handler in handlers.Reverse()) 
        {
            handler.InnerHandler = currentHandler;
            currentHandler = handler;
        }
        
        var client = new HttpClient(currentHandler);
        
        client.BaseAddress = new Uri(baseUrl);
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {authKey}");
        
        var request = new HttpRequestMessage(method, endpoint);
        
        return client.SendAsync(request);
    }
}
```

3. The Centralized Registration in `Program.cs`
This is the foundation of the advanced propagation pattern. We use a Factory Method to correctly resolve the collection of `DelegatingHandler` services into the array required by the `HttpClientService`.

```csharp
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddTransient<DelegatingHandler, CorrelationIdDelegatingHandler>();
builder.Services.AddSingleton<IHttpClientService>(provider => 
{
    var factory = provider.GetRequiredService<IHttpClientFactory>();
    var handlers = provider.GetServices<DelegatingHandler>().ToArray(); 
    return new HttpClientService(factory, handlers);
});
```

## Tracing the Log Journey (Error Scenario)

To illustrate the power of this implementation, observe the console log below. This example captures a single user request for an endpoint that retrieves a user by ID.

Crucially, the request failed because the provided ID does not exist in the database, demonstrating how the Correlation ID tracks the operation across multiple application layers and during an error condition.

Notice how the unique CorrelationId links logs from the API down to the Domain and Infrastructure layers.

![Example of log](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/xho55yijqgc7wa4b8y3c.png)

## Conclusion

Using the Correlation ID is a very powerful and essential way to improve the observability in distributed applications.

By implementing this native .NET pattern, we established a single, reliable identifier that automatically tracks requests from the initial inbound API call, through internal application logic, and finally across all outbound service calls via the custom `DelegatingHandler`. This robust, end to end solution transforms debugging and monitoring, allowing you to trace complex operations with ease and speed.
