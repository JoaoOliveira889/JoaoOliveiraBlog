---
title: Distributed Cache in .NET How to Configure and Use Redis
date: '2025-10-13T15:20:00-02:00'
tags:
- net
- cache
- redis
- performance
draft: false
---

In this article, I will show how to integrate Redis into a .NET API, using it as a Distributed Cache layer for the database. In high-read scenarios, this not only ensures an incredibly faster response time but also reduces the load and operational cost of your primary database.

For our example, we will use Redis in a local Docker container, configuring the application to communicate directly with it via the mapped port.

We will create a `Generic Repository Class (ICacheRepository<T>)` that will encapsulate the methods for key creation, retrieval, and removal. This is the most recommended pattern for maintaining a clean and reusable architecture.

## Configuring the Environment with Docker and Redis

### Installing and Starting Redis

Execute the commands below in your terminal. The first downloads the official Redis image, and the second starts the service.

```Bash
docker pull redis:latest
docker run --name my-redis -d -p 6379:6379 redis
```

**Technical Note**: The docker run command uses the -p 6379:6379 mapping to expose the container's default Redis port to your local machine. my-redis is the name of the container we will use for subsequent interactions.

#### Verifying the Connection

To ensure the service is active and accessible, use the command-line client (redis-cli) through your container:

```bash
docker exec -it my-redis redis-cli PING
```

If the response is `PONG`, Redis is working perfectly and is ready to be integrated into your .NET API.

## Structuring the .NET 9 Solution via CLI

Below are the commands to set up the project structure, separating the Web API layer from the Services and Cache layer.

### Creating the Solution and Directories

Start by creating the root project folder and the solution file (.sln).

Create the Root Directory and Navigate to the Root

```bash
mkdir RedisCacheApi
cd RedisCacheApi
```

Create the Source Directory and Navigate to src

```bash
mkdir src
cd src
```

Create the Solution File

```bash
dotnet new sln -n RedisCacheApi
```

Create the API Project (Controllers) and Create the Service Project (Class Library)

```bash
dotnet new webapi -n RedisCache.Api -f net9.0
dotnet new classlib -n RedisCache.Service -f net9.0
cd ..
```

Adding the Projects to the Solution

``` bash
dotnet sln add ./src/RedisCache.Api/RedisCache.Api.csproj
dotnet sln add ./src/RedisCache.Service/RedisCache.Service.csproj
```

Add the Reference

``` bash
dotnet add ./src/RedisCache.Api/RedisCache.Api.csproj reference ./src/RedisCache.Service/RedisCache.Service.csproj
```

Add the Redis and Logger Packages

``` bash
dotnet add src/RedisCache.Service/RedisCache.Service.csproj package Microsoft.Extensions.Caching.Abstractions

dotnet add src/RedisCache.Service/RedisCache.Service.csproj package Microsoft.Extensions.Logging.Abstractions
```

## Cache Configuration and Abstraction

To integrate Redis into your API, we start by defining the connection string in the API project's configuration file.

### Defining the Connection in appsettings.json

In the RedisCache.Api project, this file defines the port your application will use to connect to the Docker container (localhost:6379).

```json
{
  "ConnectionStrings": {
    "RedisConnection": "localhost:6379"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

**Note**: .NET Core will use the "RedisConnection" key to configure the Distributed Cache service in Program.cs

#### Configuring the Pipeline and Dependency Injection (Program.cs)

This is the point where we connect the Redis client with the generic abstraction and the business service. The key is the registration of generic types in the AddScoped line.

``` cSharp
var builder = WebApplication.CreateBuilder(args);

// 1. Pipeline Configuration
builder.Services.AddControllers(); 
builder.Services.AddLogging(); 

// 2. Distributed Redis Configuration
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("RedisConnection");
    options.InstanceName = "RedisCacheApi_"; // Optional prefix for keys in Redis
});

// 3. Registration of Services and Repositories (Dependency Injection)
builder.Services.AddScoped(typeof(ICacheRepository<>), typeof(CacheRepository<>));

// Registers the Business Service.
builder.Services.AddScoped<IUserService, UserService>(); 

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers(); 

app.Run();
```

Technical Configuration Notes

- `AddStackExchangeRedisCache`: This method, provided by the package you added, injects the Redis implementation for .NET into the system as `IDistributedCache`.
- `options.InstanceName`: The prefix is a good practice to prevent key collisions if you use the same Redis instance for multiple applications (e.g., RedisCacheApi_user:1).
- `AddScoped(typeof(ICacheRepository<>), typeof(CacheRepository<>))`: This is the crucial line. It registers the open generic repository. The .NET Dependency Injection system is smart enough that when UserService requests `ICacheRepository<User>` (the closed generic type), it correctly instantiates the `CacheRepository<User>.`

## The Controller (UsersController.cs)

This class acts as the entry point of your API, dealing only with translating HTTP requests into calls to the Business Service (IUserService).

```csharp
namespace RedisCache.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController(IUserService userService) : ControllerBase
{
        [HttpGet("GetAllUsers")]
        public async Task<ActionResult<List<User>>> GetAllUsers()
        {
            try
            {
                var users = await userService.GetAllUsersAsync();
                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal error during list retrieval: " + ex.Message);
            }
        }
        
        [HttpGet("GetUser/{id:int}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            try
            {
                var user = await userService.GetUserByIdAsync(id);
                return Ok(user);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal error: " + ex.Message);
            }
        }

        [HttpPost("CreateUser")]
        public async Task<ActionResult<User>> CreateUser([FromBody] CreateUserDto userDto)
        {
            try
            {
                var newUser = await userService.CreateUserAsync(userDto);
                return CreatedAtAction(nameof(GetUser), new { id = newUser.Id }, newUser); 
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal error: " + ex.Message); 
            }
        }

        [HttpPut("UpdateUser/{id:int}")]
        public async Task<ActionResult<User>> UpdateUser(int id, [FromBody] CreateUserDto userDto)
        {
            try
            {
                var updatedUser = await userService.UpdateUserAsync(id, userDto);
                return Ok(updatedUser);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal error during update: " + ex.Message);
            }
        }

        [HttpDelete("DeleteUser/{id:int}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            try
            {
                await userService.DeleteUserAsync(id);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal error during deletion: " + ex.Message);
            }
        }
}
```

## The Generic Cache Repository

This class implements the generic contract, translating high-level calls from your services (e.g., userCache.GetAsync("1")) to low-level Redis operations (e.g., GetStringAsync("User:1"))

```csharp
namespace RedisCache.Service.Services;

public class CacheRepository<T>(IDistributedCache cache) : ICacheRepository<T>
    where T : class
{
    private readonly string _keyPrefix = $"{typeof(T).Name}:";
    private readonly TimeSpan _defaultExpiration = TimeSpan.FromMinutes(10);
    
    private string GetCacheKey(string id) => $"{_keyPrefix}{id}";
    
    public async Task<T?> GetAsync(string id)
    {
        string key = GetCacheKey(id);
        string? cachedJson = await cache.GetStringAsync(key);

        // Returns the deserialized T object or null
        return cachedJson is null ? null : JsonSerializer.Deserialize<T>(cachedJson);
    }

    public async Task SetAsync(string id, T item, TimeSpan? expiration = null)
    {
        string key = GetCacheKey(id);
        string json = JsonSerializer.Serialize(item);

        // Sets the expiration, using the default if none is provided
        var options = new DistributedCacheEntryOptions()
            .SetAbsoluteExpiration(expiration ?? _defaultExpiration);
                
        await cache.SetStringAsync(key, json, options);
    }

    public Task RemoveAsync(string id)
    {
        string key = GetCacheKey(id);
        // Removes the key directly from Redis
        return cache.RemoveAsync(key);
    }
}
```

## The Business Service with Caching

This class implements the Cache-Aside Pattern, utilizing the abstraction of the two injected repositories (userCache and allUsersCache) to manage keys optimally.

```csharp
namespace RedisCache.Service.Services;

public class UserService(
    ICacheRepository<User> userCache,
    ICacheRepository<List<User>> allUsersCache, 
    ILogger<UserService> logger)
    : IUserService
{
    private const string AllUsersCacheKey = "all_users_list";
        
    // --- CREATE: Cache-Through and List Invalidation ---
    public async Task<User> CreateUserAsync(CreateUserDto userDto)
    {
        User newUser = new(_nextId++, userDto.Username, userDto.Email);
        Database.Add(newUser.Id, newUser);
            
        logger.LogInformation("User created in DB with ID {Id}", newUser.Id);
            
        string idString = newUser.Id.ToString();
        await userCache.SetAsync(idString, newUser); // 1. Cache-Through (saves individual)
            
        await allUsersCache.RemoveAsync(AllUsersCacheKey); // 2. Invalidates the list
            
        logger.LogInformation("All Users cache list invalidated.");
            
        return newUser;
    }

    // --- READ: Get By ID (Cache-Aside) ---
    public async Task<User> GetUserByIdAsync(int id)
    {
        string idString = id.ToString(); 
        var user = await userCache.GetAsync(idString); 

        if (user is not null)
        {
            logger.LogInformation("Cache HIT for user {Id}", id);
            return user;
        }
            
        logger.LogWarning("Cache MISS for user {Id}. Accessing DB.", id);
        await Task.Delay(200); 
            
        if (!Database.TryGetValue(id, out var userFromDb))
            throw new KeyNotFoundException($"User with ID {id} not found.");
            
        await userCache.SetAsync(idString, userFromDb); 
        logger.LogInformation("Cache updated for user {Id}", id);

        return userFromDb;
    }

    // --- READ: Get All (Collection Cache-Aside) ---
    public async Task<List<User>> GetAllUsersAsync()
    {
        var users = await allUsersCache.GetAsync(AllUsersCacheKey);
            
        if (users is not null)
        {
            logger.LogInformation("Cache HIT for ALL USERS list.");
            return users;
        }
            
        logger.LogWarning("Cache MISS for ALL USERS list. Accessing DB (1000 records).");
        await Task.Delay(400); 
            
        var usersFromDb = Database.Values.ToList();

        // Saves the list of 1000 users in the cache for 5 minutes
        await allUsersCache.SetAsync(AllUsersCacheKey, usersFromDb, TimeSpan.FromMinutes(5));
            
        logger.LogInformation("Cache updated for ALL USERS list.");

        return usersFromDb;
    }

    // --- UPDATE: Double Invalidation (Individual Key + List Key) ---
    public async Task<User> UpdateUserAsync(int id, CreateUserDto userDto)
    {
        if (!Database.ContainsKey(id)) 
            throw new KeyNotFoundException($"User with ID {id} not found for update.");

        var updatedUser = new User(id, userDto.Username, userDto.Email);
        Database[id] = updatedUser; 

        logger.LogInformation("User {Id} updated in DB.", id);

        // 1. Invalidates the individual key, as it is now outdated
        await userCache.RemoveAsync(id.ToString());
        // 2. Invalidates the total list
        await allUsersCache.RemoveAsync(AllUsersCacheKey);
            
        logger.LogInformation("Individual user key and All Users list invalidated.");
            
        return updatedUser;
    }

    // --- DELETE: Double Invalidation (Individual Key + List Key) ---
    public async Task DeleteUserAsync(int id)
    {
        if (!Database.Remove(id))
            throw new KeyNotFoundException($"User with ID {id} not found for deletion.");

        logger.LogInformation("User {Id} deleted from DB.", id);

        // 1. Invalidates the individual key
        await userCache.RemoveAsync(id.ToString());
        // 2. Invalidates the total list
        await allUsersCache.RemoveAsync(AllUsersCacheKey);
            
        logger.LogInformation("Individual user key and All Users list invalidated after deletion.");
    }
        
    // --- Static "Database" Configuration (Simulation) ---
    private static readonly Dictionary<int, User> Database;
    private static int _nextId;

    static UserService()
    {
        string seedPath = Path.Combine(AppContext.BaseDirectory, "UserSeedData.json");

        if (File.Exists(seedPath))
        {
            string jsonString = File.ReadAllText(seedPath);
            var users = JsonSerializer.Deserialize<List<User>>(jsonString) ?? [];
            
            Database = users.ToDictionary(u => u.Id, u => u);
            _nextId = users.Count > 0 ? users.Max(u => u.Id) + 1 : 1;
        }
        else
        {
            Database = new Dictionary<int, User>();
            _nextId = 1;
        }
    }
}
```

## Testing Performance and the Cache-Aside Pattern

In this section, we will prove that the architecture with the Distributed Redis Cache works, demonstrating the difference in response time between a Cache Miss (DB access) and a Cache Hit (Redis access).

For the tests, we will use the GET /api/users endpoint, which loads the complete list of 1000 users.

### Test 1: Cache Miss (First Access)

Upon the first call to the endpoint, the cache is empty. The UserService is forced to simulate a database query for the 1000 records, which introduces a purposeful latency (400ms Task.Delay).
![Get without cache](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/zyv8j28081c3c0qt748d.png)

### Test 2: Cache Hit (Subsequent Access)

The UserService saved the complete list of users to Redis after the first access. The second call (made immediately afterward) finds this data in the cache.
![Get with cache](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/lebi6slbvnf2kn8enlej.png)

### Cache Coherence Strategy (Double Invalidation)

To ensure that the list of users (/api/users) is always synchronized after a change, its implementation follows the Double Invalidation pattern.

### Read Operation (GET /api/users)

The complete list of 1000 users (key: "all_users_list") is loaded from the database only if it is empty in Redis. It is saved with a short Time To Live (TTL) (5 minutes).

### Write Operations (POST, PUT, DELETE)

Whenever the primary data source (the "database") is modified, the system triggers the invalidation of two cache keys.

This way, the list of all users is only rebuilt (with the 400ms latency cost) when there is a real necessity (right after a modification), ensuring data coherence without sacrificing performance for the vast majority of read requests.

## Conclusion

The main focus of our guide was the functional integration, where we utilized essential interaction methods:

- Cache-Aside Strategy: Ensuring that the most costly read operation (GetAllUsers) only accesses the database when necessary (Cache Miss).
- Redis Methods in Practice: Each C.R.U.D. operation demonstrated the use of fundamental Redis commands: SET (implicit when saving data to the cache) and DEL (implicit in invalidating individual and list keys).
- Proven Performance: The final test validated the reduction in response time from hundreds of milliseconds (DB access) to milliseconds (cache access).

[Project](https://github.com/JoaoOliveira889/RedisCacheApi)
