# JSX Translation with `<T>` Component

Use the `<T>` component to internationalize HTML and JSX content.

**Import:** The `<T>` component is exported from `gt-next`.

```tsx
import { T } from 'gt-next';
```

Before:

```jsx
function Greeting() {
  return <p>Hello, world!</p>;
}
```

After:

```jsx
import { T } from 'gt-next';

function Greeting() {
  return (
    <T>
      <p>Hello, world!</p>
    </T>
  );
}
```

## Context Prop

Add `context` prop when content meaning is ambiguous:

```jsx
<T context='Crop, as in cropping an image'>Crop</T>
```

RULES:

- Provide context for words with multiple meanings (e.g., "crop" = cropping an image vs the food crop).
- Provide context when the additional context can provide more information to the translator about the surrounding content, that is not obvious from the content itself.

## Usage Rules

**USE `<T>` for:**

- Static HTML or JSX content
- Dynamic content wrapped in Variable Components or Branching Components

**DO NOT USE `<T>` for:** Raw dynamic content (unwrapped variables, expressions, conditionals)

### Notes on Variable Components

Variable components are safe for `<T>` because content is wrapped and sanitized. Variable component content is never translated directly by `<T>`.

### Invalid Usage Examples (Raw Dynamic Content)

```jsx
<T>
  <p>Your username is {username}</p>
</T>
```

```jsx
<T>
  <p>Current date: {new Date().toLocaleDateString()}</p>
</T>
```

```jsx
<T>
  <p>Logical Expressions: {username === 'admin' ? 'Yes' : 'No'}</p>
</T>
```

```jsx
<T>
  <p>Conditional Rendering: {isAdmin ? 'Yes' : 'No'}</p>
</T>
```

**Solution: Wrap dynamic content in variable components or branching components, then use with `<T>`.**

## Valid Usage Examples

### HTML and JSX Content

```jsx
// Before
<p>Hello, world!</p>
<Button>Click me!</Button>

// After
<T>
  <p>Hello, world!</p>
</T>
<T>
  <Button>Click me!</Button>
</T>

// Or, you can wrap both components with `<T>`
<T>
  <p>Hello, world!</p>
  <Button>Click me!</Button>
</T>
```

### Complex JSX Content

```jsx
// Before
<Tooltip>
  <TooltipTrigger>
    <div className='flex items-center gap-2 rounded-full bg-destructive px-3 py-1.5 text-sm text-destructive-foreground'>
      <AlertCircle className='h-4 w-4' />
      <span>Free Usage</span>
    </div>
  </TooltipTrigger>
  <TooltipContent>
    <p>
      You are nearing your free monthly limit. Please upgrade your plan to avoid
      any disruptions to your service.
    </p>
  </TooltipContent>
</Tooltip>

// After
<T>
  <Tooltip>
    <TooltipTrigger>
      <div className='flex items-center gap-2 rounded-full bg-destructive px-3 py-1.5 text-sm text-destructive-foreground'>
        <AlertCircle className='h-4 w-4' />
        <span>Free Usage</span>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>
        You are nearing your free monthly limit. Please upgrade your plan to
        avoid any disruptions to your service.
      </p>
    </TooltipContent>
  </Tooltip>
</T>
```

**NOTE: `<T>` handles any nested content within the same component.**

## Common Pitfalls and Solutions

### Direct Descendants Only

Rule: `<T>` only translates content directly between its tags. Content inside nested components is not translated.

```jsx
// INCORRECT - UntranslatedContent not translated
function UntranslatedContent() {
  return <p>This content is not translated</p>;
}

export default function DisplayGreetings() {
  return (
    <T>
      <h1>Hello, this text will be translated</h1>
      <UntranslatedContent />
    </T>
  );
}
```

Only content literally between `<T>` tags is translated. The `<h1>` is translated, but `<UntranslatedContent>` is not.

**Solution:**

```jsx
// CORRECT - Each component wraps its own content
function TranslatedContent() {
  return (
    <T>
      <p>
        This content <b>IS</b> translated
      </p>
    </T>
  );
}

export default function DisplayGreetings() {
  return (
    <>
      <T>
        <h1>Hello, this text will be translated</h1>
      </T>
      <TranslatedContent />
    </>
  );
}
```

### Nested `<T>` Components

Rule: Never nest `<T>` components. This causes unexpected behavior and performance issues.

```jsx
// INCORRECT - Nested T components
function SomeComponent() {
  return <T>Hello, friend!</T>;
}

export default function NestedTranslation() {
  return (
    <T>
      <T>Hello, world!</T> {/* Don't nest */}
      <SomeComponent /> {/* This also nests */}
    </T>
  );
}
```

Solution: Remove the outer `<T>` component.

### Raw Dynamic Content Error

Raw dynamic content in `<T>` will cause an error.

```jsx
// WILL ERROR - Raw dynamic content
const username = 'John Doe';
<T>
  <p>Your username is {username}</p>
</T>;
```

**Solutions:**

1. Wrap dynamic content in Variable Components or Branching Components, then use with `<T>`
2. Use `<Tx>` component for on-demand translation (**use only when necessary, and on server components**)

### Implementing Variable contents incorrectly

The following syntax is wrong and was likely confused with the `useGT()` hook.

```jsx
// WILL ERROR - Improper syntax
const username = 'John Doe';
<T variables={{ username }}>Hello, {username}</T>;
```

The correct implementation is as follows:

```jsx
// WILL ERROR - Improper syntax
const username = 'John Doe';
<T>
  Hello, <Var>{username}</Var>
</T>;
```

## Summary

- Use `<T>` to internationalize static JSX content
- Use `<T>` with dynamic content only when wrapped in Variable/Branching Components
- Never use `<T>` for raw dynamic content (unwrapped variables, expressions, conditionals)
- Never nest `<T>` components
- Only content directly between `<T>` tags is translated
