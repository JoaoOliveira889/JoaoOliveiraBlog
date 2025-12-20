---
title: Stack, Queue and PriorityQueue in cSharp
date: '2025-11-04T15:20:00-02:00'
tags:
- net
- leetcode
- algorithms
draft: false
---

`Stack`, `Queue` and `PriorityQueue` are fundamental data structures used to store, organize and manage data efficiently in C#.
They are not only useful for solving algorithm challenges, but also extremely valuable in real-world applications such as searching, ordering tasks, inserting, removing and updating data in different workflows.
In this article, I will show the main characteristics of each one, explain how they work, and demonstrate real-world usage scenarios to help reinforce memorization and understanding.
So, let's start talking about these important data structures in C#.

## Stack

A `Stack<T>` represents a **LIFO** (Last In, First Out) collection.
This means the last item added will be the first one removed.

### Stack Constructor

| Constructor                        | Description                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `Stack()`                          | Creates an empty stack.                                                                       |
| `Stack(int capacity)`              | Creates a stack with an initial internal capacity. Useful when the expected size is known.    |
| `Stack(IEnumerable<T> collection)` | Creates a stack with items copied from another collection (the last element becomes the top). |

### Stack Core Operations

| Member                  | Description                                               | Example                                 |
| ----------------------- | --------------------------------------------------------- | --------------------------------------- |
| `Push(T item)`          | Adds an item to the top                                   | `stack.Push("A");`                      |
| `Pop()`                 | Removes and returns the top item. Throws if empty         | `var item = stack.Pop();`               |
| `Peek()`                | Returns the top item without removing it. Throws if empty | `var item = stack.Peek();`              |
| `TryPop(out T result)`  | Safe Pop (returns false if empty)                         | `if(stack.TryPop(out var value)){...}`  |
| `TryPeek(out T result)` | Safe Peek (returns false if empty)                        | `if(stack.TryPeek(out var value)){...}` |

### Stack Utility Methods

| Member             | Description                                 |
| ------------------ | ------------------------------------------- |
| `Count`            | Number of elements in the stack             |
| `Clear()`          | Removes all items                           |
| `Contains(T item)` | Checks if the stack contains the given item |
| `ToArray()`        | Returns a new array in LIFO order           |
| `GetEnumerator()`  | Iterates through the stack (top → bottom)   |
| `TrimExcess()`     | Reduces memory usage after many removals    |

### Stack Example

``` cSharp
Stack<string> stack = new();

stack.Push("First");
stack.Push("Second");
stack.Push("Third");
Console.WriteLine("Top of the stack: " + stack.Peek());
Console.WriteLine("Removing items:");
while (stack.Count > 0)
Console.WriteLine(stack.Pop());
Console.WriteLine("Stack empty? " + (stack.Count == 0));
```

### Stack Output

```csharp
Top of the stack: Third
Removing items:
Third
Second
First
Stack empty? True
```

![How a stack works](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/xr6zlbtbfcn7ycevppyp.png)

## Queue

A `Queue<T>` represents a **FIFO** (First In, First Out) collection.
The first element inserted is the first one removed.

### Queue Constructor

| Constructor                        | Description                                                                |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `Queue()`                          | Creates an empty queue.                                                    |
| `Queue(int capacity)`              | Creates a queue with a predefined capacity.                                |
| `Queue(IEnumerable<T> collection)` | Initializes a queue with elements, where the first item becomes the front. |

### Queue Core Operations

| Member                     | Description                                          | Example                                   |
| -------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| `Enqueue(T item)`          | Adds an item to the back (tail).                     | `queue.Enqueue("A");`                     |
| `Dequeue()`                | Removes and returns the front item. Throws if empty. | `var item = queue.Dequeue();`             |
| `Peek()`                   | Returns the front item without removing it.          | `var item = queue.Peek();`                |
| `TryDequeue(out T result)` | Safe dequeue                                         | `if(queue.TryDequeue(out var x)) { ... }` |
| `TryPeek(out T result)`    | Safe peek                                            | `if(queue.TryPeek(out var x)) { ... }`    |

### Queue Utility Methods

| Member                         | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `Count`                        | Number of elements                                |
| `Contains(T item)`             | Checks if the item exists                         |
| `ToArray()`                    | Returns items in FIFO order                       |
| `Clear()`                      | Removes all elements                              |
| `GetEnumerator()`              | Iterates through the queue front → back           |
| `EnsureCapacity(int capacity)` | Ensures enough internal storage to avoid resizing |
| `TrimExcess()`                 | Reduces unused memory                             |

### Queue Code

``` cSharp
Queue<string> queue = new();

queue.Enqueue("First");
queue.Enqueue("Second");
queue.Enqueue("Third");

Console.WriteLine("Front of the queue: " + queue.Peek());

Console.WriteLine("Processing queue:");
while (queue.Count > 0)
    Console.WriteLine(queue.Dequeue());

Console.WriteLine("Queue empty? " + (queue.Count == 0));
```

### Queue Output

```csharp
Front of the queue: First
Processing queue:
First
Second
Third
Queue empty? True
```

![How a Queue works](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dryizyylvngh89sw37b1.png)

## PriorityQueue

A `PriorityQueue<TElement, TPriority>` is similar to a Queue, except element removal is based on priority, not insertion order.
By default, it behaves as a Min-Heap (lower priority value = higher priority).

Type:

```cSharp
PriorityQueue<TElement, TPriority>
```

- `TElement` → the value you are storing
- `TPriority` → determines the processing order (lower numbers = higher priority by default)

### PriorityQueue Constructors

| Consctructor                                                                                     | Description                               |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `PriorityQueue()`                                                                                | Creates an empty priority queue           |
| `PriorityQueue(int initialCapacity)`                                                             | Pre-allocates capacity to reduce resizing |
| `PriorityQueue(IEnumerable<(TElement,TPriority)> items)`                                         | Creates a queue with the specified items  |
| `PriorityQueue(IEnumerable<(TElement,TPriority)> items, IComparer<TPriority>? priorityComparer)` | Same, but allows custom priority logic    |

### PriorityQueue Core Methods

| Member                                                     | Description                                           | Example                                            |
| ---------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `Enqueue(TElement element, TPriority priority)`            | Adds an element with its priority                     | `queue.Enqueue("Task", 2);`                        |
| `Dequeue()`                                                | Removes and returns the element with highest priority | `var item = queue.Dequeue();`                      |
| `Peek()`                                                   | Returns the highest priority element without removing | `var item = queue.Peek();`                         |
| `TryDequeue(out TElement element, out TPriority priority)` | Safe dequeue                                          | `if(queue.TryDequeue(out var e, out var p)) {...}` |
| `TryPeek(out TElement element, out TPriority priority)`    | Safe peek                                             | `if(queue.TryPeek(out var e, out var p)) {...}`    |

### PriorityQueue Utility Methods

| Member                              | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `Count`                             | Number of items                                     |
| `Clear`                             | Removes all elements                                |
| `EnsureCapacity(int capacity)`      | Pre-allocates memory                                |
| `TrimExcess()`                      | Reduces memory usage                                |
| `EnqueueDequeue(element, priority)` | Inserts item then removes the highest priority item |
| `UnorderedItems`                    | Returns internal items in no particular order       |

### PriorityQueue Code

``` cSharp
PriorityQueue<string, int> queue = new();

queue.Enqueue("Fix critical bug", 1);
queue.Enqueue("Team meeting", 2);
queue.Enqueue("Review PR", 3);

Console.WriteLine($"Count: {queue.Count}");
Console.WriteLine($"Peek: {queue.Peek()}");

if (queue.TryDequeue(out string? task, out int priority))
    Console.WriteLine($"Dequeued: {task} (Priority {priority})");

queue.EnqueueRange([
    ("Refactor service", 4),
    ("Write documentation", 5)
]);

string removed = queue.EnqueueDequeue("Urgent hotfix", 0);
Console.WriteLine($"Removed during EnqueueDequeue: {removed}");

Console.WriteLine("\nRemaining items by priority:");
while (queue.TryDequeue(out string? t, out int p))
    Console.WriteLine($"→ {t} (p={p})");

queue.TrimExcess();
```

### PriorityQueue Output

```csharp
Count: 3
Peek: Fix critical bug
Dequeued: Fix critical bug (Priority 1)
Removed during EnqueueDequeue: Urgent hotfix

Remaining items by priority:
→ Team meeting (p=2)
→ Review PR (p=3)
→ Refactor service (p=4)
→ Write documentation (p=5)
```

![How a PriorityQueue works](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/89ju3ogeny7hx2kjmr2t.png)

## Turning PriorityQueue into Max-Heap

To return the highest number instead of the lower in a PriorityQueue you can create a custom comparer:

```cSharp
var queue = new PriorityQueue<string, int>( comparer: Comparer<int>.Create((x, y) => y.CompareTo(x)));
```

Example:

```cSharp
var queue = new PriorityQueue<string, int>( comparer: Comparer<int>.Create((x, y) => y.CompareTo(x)));

queue.Enqueue("Low importance", 1);
queue.Enqueue("Medium importance", 5);
queue.Enqueue("High importance", 10);

while (queue.TryDequeue(out string? task, out int priority))
    Console.WriteLine($"{task} (priority {priority})");
```

```csharp
High importance (priority 10)
Medium importance (priority 5)
Low importance (priority 1)
```

## Stack vs Queue vs PriorityQueue (Quick Comparison)

| Structure     | Order Rule                 | Core Operations                      | Example Use Case                                |
| ------------- | -------------------------- | ------------------------------------ | ----------------------------------------------- |
| Stack         | LIFO (Last In, First Out)  | Push / Pop / Pee                     | Undo systems, Call stack, DFS                   |
| Queue         | FIFO (First In, First Out) | Enqueue / Dequeue / Peek             | Scheduling, Task processing, BFS                |
| PriorityQueue | Priority-based ordering    | Enqueue(element, priority) / Dequeue | Job scheduling, AI pathfinding, Hospital triage |

## Real Word Examples

### Stack - Undo History

When typing in a text editor, each action gets pushed into a history stack.
If the user presses Undo, we pop the last action.

```cSharp
var undoStack = new Stack<string>();

Type("Hello");
Type("Hello World");
Type("Hello World!");

Undo(); // removes "Hello World!"
Undo(); // removes "Hello World"
return;

void Undo()
{
    if (undoStack.TryPop(out string? lastAction))
        Console.WriteLine($"Undo → removed: {lastAction}");
}

void Type(string text)
{
    undoStack.Push(text);
    Console.WriteLine($"Typed: {text}");
}
```

### Queue - Print Queue

Print Queue (Printers process jobs in arrival order)

```cSharp
var printQueue = new Queue<string>();

AddPrintJob("Report.pdf");
AddPrintJob("Invoice.docx");
AddPrintJob("Presentation.pptx");

ProcessNextJob(); // Report
ProcessNextJob(); // Invoice
ProcessNextJob(); // Presentation
return;

void ProcessNextJob()
{
    if (printQueue.TryDequeue(out string? job))
        Console.WriteLine($"Printing: {job}");
}

void AddPrintJob(string document)
{
    printQueue.Enqueue(document);
    Console.WriteLine($"Added: {document}");
}
```

### PriorityQueue - Hospital ER Triage

Hospital Emergency Room Triage
Patients are not seen in order of arrival — they are seen by severity.

```cSharp
var erQueue = new PriorityQueue<string, int>(
    comparer: Comparer<int>.Create((a, b) => a.CompareTo(b)) // lower value = higher priority
);

erQueue.Enqueue("Head trauma", 1);
erQueue.Enqueue("Broken arm", 4);
erQueue.Enqueue("High fever", 3);
erQueue.Enqueue("Cardiac arrest", 0);

Console.WriteLine("Patients being treated:");
while (erQueue.TryDequeue(out string? patient, out int severity))
    Console.WriteLine($"{patient} (severity {severity})");
```
