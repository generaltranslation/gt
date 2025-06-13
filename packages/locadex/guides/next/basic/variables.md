# Variable Components Overview

Variable components wrap dynamic content like user names, numerical values, dates, and currencies. They format and render dynamic values according to the user's locale without requiring external translations.

Variable components can be used as children of `<T>` components or as standalone components.
When used as children of `<T>` components, the variable components are correctly formatted according to the user's locale.

**Import:** The variable components are exported from `gt-next`.

```tsx
import { Var, Num, Currency, DateTime } from 'gt-next';
```

**Key Behavior:**

- `<Var>`: Renders any content dynamically (user names, identifiers)
- `<Num>`: Formats numbers with locale-specific rules
- `<Currency>`: Formats currency with symbols and localization
- `<DateTime>`: Formats dates/times with locale conventions

---

## Usage Patterns

### Basic Syntax

All variable components use identical wrapping syntax:

```tsx
import { Var, Num, Currency, DateTime } from 'gt-next';

<Var>{user.name}</Var>;
<Num>{user.age}</Num>;
<Currency>{user.balance}</Currency>;
<DateTime>{user.birthday}</DateTime>;
```

### Integration with `<T>` Components

Variable components require locale context for formatting. Use within `<T>` components for automatic locale handling:

```tsx
<T>
  The current time is <DateTime>{time}</DateTime>.
</T>
```

The `<T>` component provides locale context and translates surrounding text while preserving variable formatting.

### Localization Behavior

**Automatic Formatting:**

- `<Num>`: Localized decimal separators and number formatting
- `<Currency>`: Localized currency symbols and positioning
- `<DateTime>`: Locale-specific date/time conventions

**Customization:** Override default locale and formatting via component props.

## Use Cases by Component

- `<Var>`: Unformatted private data (user names, account numbers), or conditional content that should be excluded from translation
- `<Num>`: Private numbers needing locale formatting (quantities, ages, distances)
- `<Currency>`: Private currency values (transactions, balances)
- `<DateTime>`: Private dates/times (timestamps, creation dates)

---

## Implementation Examples

### `<Var>` - Dynamic Content Isolation

**Basic Usage:** Always use with `<T>` to isolate dynamic content from translation processing.

```jsx
<T>
  Hello, <Var>{user.name}</Var>! Your address is <Var>{user.addr}</Var>
</T>
```

**Dynamic Component Rendering:** Isolate conditional logic within `<T>`.

```jsx
<T>
  Your Dashboard:
  <Var>{isAdmin ? <AdminDashboard /> : <UserDashboard />}</Var>
</T>
```

**Rule:** Wrap all dynamic content in `<Var>` when using `<T>` components.

### `<Num>` - Number Formatting

**Within `<T>`:** Automatic locale-aware formatting.

```jsx
<T>
  You have <Num>{quantity}</Num> items in your cart.
</T>
```

**Standalone:** Equivalent to `quantity.toLocaleString()`

```jsx
<Num>{quantity}</Num>
```

**Rule:** Wrap all dynamic numbers in `<Num>` when using `<T>` components.

### `<Currency>` - Currency Formatting

**Within `<T>`:** Requires `currency` prop for proper formatting.

```jsx
<T>
  Your total is <Currency currency={'USD'}>{total}</Currency>.
</T>
```

**Standalone:** Formats as localized currency (e.g., $1,000)

```jsx
<Currency currency={'USD'}>{total}</Currency>
```

**Rule:** Wrap all dynamic currency values in `<Currency>` when using `<T>` components.

### `<DateTime>` - Date/Time Formatting

**Within `<T>`:** Automatic locale-aware date formatting.

```jsx
<T>
  Your order was placed on <DateTime>{date}</DateTime>.
</T>
```

**Standalone:** Equivalent to `date.toLocaleDateString()` or `date.toLocaleTimeString()`

```jsx
<DateTime>{date}</DateTime>
```

**Rule:** Wrap all dynamic date/time values in `<DateTime>` when using `<T>` components.

---

## Common Implementation Issues

### Missing Required Props

**Critical:** `<Currency>` requires `currency` prop for proper symbol and formatting.

**Optimization:** All formatting components accept optional props for custom locale behavior.

## API References

- [`<Var>`](/docs/next/api/components/var) - Dynamic content wrapper
- [`<Num>`](/docs/next/api/components/num) - Number formatting options
- [`<Currency>`](/docs/next/api/components/currency) - Currency formatting options
- [`<DateTime>`](/docs/next/api/components/datetime) - Date/time formatting options
