# Software Development Best Practices

This document serves as a reference guide for development principles and rules adopted in this project, aiming to keep the code clean, maintainable, and scalable.

## SOLID Principles

SOLID is an acronym for five design principles that make software more understandable, flexible, and maintainable.

### S - Single Responsibility Principle (SRP)
**Single Responsibility Principle**

> "A class should have one, and only one, reason to change."

**Explanation:** A class (or module/function) should be responsible for only one part of the software's functionality. If a class assumes too many responsibilities, it becomes coupled and fragile to changes.

**Example:**
- **Bad:** A `User` class that handles authentication, data validation, and email sending.
- **Good:** Separate into `UserAuthentication`, `UserValidator`, and `EmailService`.

### O - Open/Closed Principle (OCP)
**Open/Closed Principle**

> "Software entities (classes, modules, functions, etc.) should be open for extension, but closed for modification."

**Explanation:** You should be able to extend a class's behavior without modifying its original source code. This is usually achieved through polymorphism and abstraction.

**Example:**
- **Bad:** A giant `switch` case to calculate discounts that needs to be changed for every new discount type.
- **Good:** A `DiscountStrategy` interface with different implementations. New strategies can be added by creating new classes without touching existing code.

### L - Liskov Substitution Principle (LSP)
**Liskov Substitution Principle**

> "Derived classes must be substitutable for their base classes."

**Explanation:** If `S` is a subtype of `T`, then objects of type `T` can be replaced with objects of type `S` without altering any of the desirable properties of that program (correctness, task performed, etc.). Basically, subclasses should not break the expected behavior of the parent class.

**Example:**
- **Bad:** A `Square` class inheriting from `Rectangle` and changing the behavior of `setHeight` to also change the width (violating the expectation of `Rectangle` users).
- **Good:** Both implement a `Shape` interface or maintain consistent behaviors.

### I - Interface Segregation Principle (ISP)
**Interface Segregation Principle**

> "Many client-specific interfaces are better than one general-purpose interface."

**Explanation:** No client should be forced to depend on methods it does not use. Split huge interfaces into smaller and more specific ones.

**Example:**
- **Bad:** A `Worker` interface with `eat()` and `work()` methods. Robots implement `Worker` but don't eat, forced to implement empty `eat()` or throw error.
- **Good:** Separate interfaces `Workable` and `Eatable`.

### D - Dependency Inversion Principle (DIP)
**Dependency Inversion Principle**

> "Depend upon abstractions, [not] concretions."

**Explanation:** High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions.

**Example:**
- **Bad:** An `OrderService` class directly instantiating `MySQLDatabase` inside it.
- **Good:** `OrderService` depends on a `DatabaseRepository` interface, which is implemented by `MySQLDatabase` and injected via constructor.

 ---

## Clean Code

The goal of Clean Code is to write code that is easy to understand and maintain. Code is read much more often than it is written.

### Meaningful Names
- Use names that reveal intent. Avoid obscure abbreviations.
- **Bad:** `int d; // elapsed time in days`
- **Good:** `int elapsedTimeInDays;`
- **Bad:** `function getThem() { ... }`
- **Good:** `function getFlaggedCells() { ... }`

### Small Functions
- Functions should do one thing only, and do it well.
- They should be small (ideally fit on one screen without scrolling).
- Avoid side effects.

### Comments
- "Don't comment bad code—rewrite it."
- Comments should explain the *why*, not the *how* (the code should explain the how).
- Self-explanatory code is always preferable to comments.

### Formatting
- Maintain consistency in indentation and spacing.
- Group related lines and separate logical blocks with blank lines.

### Error Handling
- Use exceptions rather than return codes.
- Do not return `null` if you can avoid it (use Optionals or empty objects).
- Do not pass `null` as an argument.

---

## Other Important Practices

### DRY (Don't Repeat Yourself)
- "Don't repeat yourself."
- Avoid logic duplication. If you copy and paste code, you should probably abstract it into a reusable function or component.

### KISS (Keep It Simple, Stupid)
- "Keep it simple, stupid."
- The simplest solution is usually the best. Avoid unnecessary complexity and over-engineering.

### YAGNI (You Aren't Gonna Need It)
- "You aren't gonna need it."
- Do not implement functionalities based on future assumptions. Implement only what is necessary now.

### Boy Scout Rule
- "Leave the campground cleaner than you found it."
- When touching a code file, try to leave it a little better than it was before (rename a variable, extract a function, etc.).

---

## Architecture and Structure

For growing projects, organization is vital.

- **Clean Architecture / Hexagonal**: Separate the "Core" (Business Logic) from the "Shell" (Infrastructure, UI, DB). This allows you to change the UI without touching business rules.
- **SoC (Separation of Concerns)**: Separate responsibilities into well-defined layers.
- **DDD Concepts (Domain-Driven Design)**:
    - **Ubiquitous Language**: Use the same terms that business people use in your code.
    - **Bounded Contexts**: Divide the system into smaller, independent areas (e.g., Authentication vs. Gamification).

---

## Testing Strategy (Vitest + RTL)

We use **Vitest** alongside **React Testing Library** and adopt a **Bottom-Up** approach for the UI:

1. **Components First (`src/__tests__/components/`)**: Test isolated, small components focusing on their behavior and rendering.
2. **Views/Screens (`src/__tests__/views/`)**: Test full screens by integrating the previously tested components, simulating actual user flow (like clicking buttons and verifying callbacks).
3. **Backend Logic (`server/vitest.config.ts`)**: Test pure game mathematically rules and state transitions without WebSocket overhead.
- **Behavior over Implementation**: Always test what the user sees (texts, buttons, roles) rather than internal React state.

---

## Modern Development Practices

- **Code Reviews**: It's not about pointing out mistakes, it's about sharing knowledge and ensuring consistency.
- **CI/CD (Continuous Integration / Delivery)**: Full automation. If the test fails, the deploy doesn't happen.
- **Observability**: Logging isn't enough. You need metrics and tracing to understand what happens in production (Traces, Metrics, Logs).
- **Shift Left Security**: Think about security from the start, not as a final step.

---

This document should evolve with the project. If you find new patterns or rules that improve our workflow, propose changes here.
