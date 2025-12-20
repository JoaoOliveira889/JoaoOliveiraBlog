---
title: Native Mapping in NET Take Control with Extension Methods
date: '2025-10-16T15:20:00-02:00'
tags:
- net
- mapping
- perfomance
draft: false
---

In the .NET universe, transforming objects from one type to another — like from Entities to DTOs — is part of the routine.

Most of us use libraries like AutoMapper or Mapster, which do this job elegantly. But... what if you want to have total control, ditch the magic, and even improve performance in some scenarios?
If this idea makes sense to you, come with me, because today we're going to talk about how to do native mapping in .NET using extension methods.

Why manual mapping?

- Zero external dependency: One less library in your project.
- Absolute control over conversion rules: No surprises, no implicit behavior.
- Better performance in critical scenarios: Manual mapping is often faster than solutions based on reflection or expression.

**Point of attention**: You'll have to write (and maintain) the mapping by hand. The question is: is it worth it for your project?

## Practical scenario: DTOs + User Entity

### DTOs

```cSharp
public class UserRequestDto
{
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
}

public class UserResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UserUpdateDto : UserRequestDto
{
    public Guid Id { get; set; }
}
```

### Entity

```csharp
public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
```

### Mapping class using extension methods

```csharp
public static class UserMapping
{
    // Creation
    public static User ToCreateUser(this UserRequestDto dto) => new()
    {
        Name = dto.Name,
        Email = dto.Email,
        Password = dto.Password,
        CreatedAt = DateTime.UtcNow
    };

    // Update
   public static void MapToUpdate(this User existingUser, UserUpdateDto userUpdateDto)
    {
        existingUser.Name = userUpdateDto.Name;
        existingUser.Email = userUpdateDto.Email;
        existingUser.Password = userUpdateDto.Password;
        existingUser.UpdatedAt = DateTime.UtcNow;
    }

    // Return
    public static UserResponseDto ToReturnUser(this User user) => new()
    {
        Id = user.Id,
        Name = user.Name,
        Email = user.Email,
        CreatedAt = user.CreatedAt,
        UpdatedAt = user.UpdatedAt
    };
}
```

Attention: The password is being mapped directly here only for didactic example purposes. In practice, always implement secure hashing (and never store passwords in plain text).

### Create a user

```csharp
public async Task<string> CreateUser(UserRequestDto dto)
{
    var user = dto.ToCreateUser();
    var result = await _userRepository.CreateUser(user);

    return result ? "User created successfully." : "Creation failed.";
}
```

### Update an existing user

```csharp
public async Task<string> UpdateUser(UserUpdateDto dto)
{
    var user = await _userRepository.GetUserById(dto.Id);
    if (user is null)
        return "User not found.";

    user.MapToUpdate(dto);

    var result = await _userRepository.UpdateUser(user);

    return result ? "User updated successfully." : "Error updating.";
}
```

### Get by Id

```csharp
public async Task<UserResponseDto?> GetUserById(Guid id)
{
    var user = await _userRepository.GetUserById(id);
    return user?.ToReturnUser();
}
```

### List all

```csharp
public async Task<IEnumerable<UserResponseDto>> GetAllUsers()
{
    var users = await _userRepository.GetAllUsers();
    return users.Select(user => user.ToReturnUser());
}
```

## Advantages and Disadvantages

Pros:

- Simple, explicit, and direct code.
- Zero magic: you know exactly what is happening.
- Better performance in many cases, especially when compared to libraries that use reflection or expression.

Cons:

- Manual code requires maintenance. If the model changes, you need to remember to update the methods.
- In very large systems, the volume of mappings can grow considerably.
- Without care, it can generate repetitive code.

Example project
I uploaded a complete project with this example on [GitHub](https://github.com/JoaoOliveira889/DotNetImplicitConvert)
