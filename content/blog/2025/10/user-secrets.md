---
title: User Secrets The Right Way to Protect API Keys in NET
date: '2025-10-12T15:20:00-02:00'
tags:
- net
- secret
- security
- ApiKey
draft: false
---

This tutorial demonstrates how to use the **User Secrets Manager** in an .Net Web API to store sensitive configuration data, such as API tokens, ensuring they are never accidentally committed to source control.

## Step 1: Project Setup via CLI

Create a new Web API project

``` Bash
dotnet new webapi -n SecretsDemo
cd SecretsDemo
```

Enable the User Secrets storage for this project

```Bash
dotnet user-secrets init
```

Output confirms UserSecretsId added to .csproj
> A UserSecretsId is added to the project file.

The `.NET` user-secrets init command creates a unit ID for your project and adds it to the `SecretsDemo.csproj` file. this ID links your project to the local `secrets.json`file on your machine.

## Step 2: Define Configuration Structure

In the appsettings.json we have the credentials to access and authentication in a external service for save logs called "ExternalLogger", we need to connect the props

```json
{
  "ExternalLogger": {
    "BaseUrl": "https://logservice.com/v1",
    "ApiKey": "",
    "MinimumLevel": "Information" 
  }
}
```

## Step 3: Create the  Option Class

In .NET standard approach is to map configuration sections to C# classes. This provides type safety and better structure.

Create a new folder named `Configuration` and add the following class:

`Configuration/ExternalLoggerOptions.cs"

```cSharp
namespace SecretsDemo.Configuration;

public class ExternalLoggerOptions
{
    // Define a constant for the section name to avoid magic strings
    public const string ExternalLogger = "ExternalLogger";
        
    public string BaseUrl { get; set; } = string.Empty;
        
    // This is the sensitive property that will be stored in User Secrets
    public string? ApiKey { get; set; } 
        
    public string MinimumLevel { get; set; } = "Warning";
}
```

## Step 4: Implement the Demo Service

Create a service that consume the configuration. This service will contains a logic to check if the required secret is available.

Create a new folder named `Services` and add the following class:

`Services/LoggerService.cs`

```cSharp
namespace SecretsDemo.Services;

public class LoggerService(IOptions<ExternalLoggerOptions> options)
{
    private readonly ExternalLoggerOptions _options = options.Value;
    
    public string LogMessage(string message)
    {
        // Crucial validation logic: is the secret present?
        if (string.IsNullOrEmpty(_options.ApiKey))
        {
            // Message when the secret is missing
            return "ERROR: The ExternalLogger Token is missing. Please configure User Secrets!";
        }

        // Simulates real use where the token allows the operation
        var logDetails = $"Base URL: {_options.BaseUrl} | Level: {_options.MinimumLevel}";
            
        // Token would be used here
        return $"Log of '{message}' sent successfully! Config: {logDetails}";
    }
}
```

## Step 5: Register and Consume

Update the `Program.cs`file to register your configuration class and your new service with the DI container.

``` cSharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ExternalLoggerOptions>(
    builder.Configuration.GetSection(ExternalLoggerOptions.ExternalLogger)
);

builder.Services.AddSingleton<LoggerService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapGet("/log", (LoggerService logger) => 
    Results.Ok((object?)logger.LogMessage("Test message from the API")));

app.Run();
```

## Step 6: Test and Add the Secret

First run the application without the secret to test what happen when the secret is not found. This is the expected result:
`ERROR: The ExternalLogger Token is missing. Please configure User Secrets!`

Now add the Secret

```Bash
dotnet user-secrets set "ExternalLogger:ApiKey" "xdfs989-fs990fs-fdas"
```

Run the application again and this is the expected result:

`Log of 'Test message from the API' sent successfully! Config: Base URL: https://logservice.com/v1 | Level: Information`

## Step 7: Modifying, Deleting, and Viewing User Secrets

The `.NET` CLI provides three simple commands to manage your secrets stored in the local `secrets.json` file. Remember to execute these commands from your project's root directory.

Changing a Secret

```Bash
dotnet user-secrets set "ExternalLogger:ApiKey" "abc-fsfsfsd-erwerw3"
```

Deleting a Specific Secret

```Bash
dotnet user-secrets remove "ExternalLogger:ApiKey"
```

Viewing All Secrets

```Bash
dotnet user-secrets list
```

Bulk Deletion

```Bash
dotnet user-secrets clear
```

## Conclusion

The **User Secrets Manager** is crucial development tool that prevents sensitive keys from entering source control. However, for **Production** environments, it is imperative to use a dedicated secret store like Azure Key Vault or AWS Secrets Manager.
