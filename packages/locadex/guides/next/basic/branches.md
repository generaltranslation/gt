## Branch Components Overview

Branch components dynamically render different content based on conditional values or numeric quantities. They handle locale-aware conditional logic and pluralization rules.

**Import:** Branch components are exported from `gt-next`.

```tsx
import { Branch, Plural } from 'gt-next';
```

**Key Behavior:**

- `<Branch>`: Renders content based on conditional branch values
- `<Plural>`: Handles pluralization with locale-specific rules

**Processing Model:**

- JSX content → General Translation API for translation
- Branch logic → Local conditional rendering
- `<Plural>` → Uses Unicode CLDR pluralization rules

**Important:** When used within `<T>` components, branch content is translated. When used standalone, content renders without translation.

**Integration with Variables:** Branch components are often combined with variable components like `<Num>` for locale-aware dynamic content.

---

## Usage Patterns

### Basic Syntax

Branch components use condition-based prop patterns:

```tsx
<Branch branch={condition} key1={content1} key2={content2}>
  Fallback content
</Branch>

<Plural n={number} one={singular} other={plural}>
  Fallback content
</Plural>
```

### Integration with `<T>` Components [#branch-in-t]

Branch components require translation context for localized content. Use within `<T>` components for automatic translation:

```tsx
<T>
  <Branch
    branch={status}
    active={<p>User is active</p>}
    inactive={<p>User is inactive</p>}
  >
    Status unknown
  </Branch>
</T>
```

The `<T>` component provides translation context and localizes branch content.

### Pluralization Behavior [#plural-logic]

**Automatic Rule Selection:** `<Plural>` uses Unicode CLDR rules to determine correct plural form based on `n` value and current locale.

**Customization:** Override default plural forms with specific CLDR categories:

```tsx
<Plural
  n={count}
  zero={<>No items</>}
  one={<>One item</>}
  two={<>Two items</>}
  few={<>Few items</>}
  many={<>Many items</>}
  other={<>Other items</>}
  dual={<>Dual items</>}
  // OR simplified
  singular={<>One item</>}
  plural={<>Multiple items</>}
/>
```

**Available Forms:** zero, one, two, few, many, other, dual (locale-dependent), plus simplified singular/plural.

---

## Implementation Examples

### `<Branch>` - Conditional Logic Replacement [#branch-conditionals]

**Replacing Ternary Operators:** Convert inline conditional logic to declarative branch syntax.

```tsx
// Instead of: {isActive ? <p>Active</p> : <p>Inactive</p>}
<Branch branch={isActive} true={<p>Active</p>} false={<p>Inactive</p>}>
  Status unknown
</Branch>
```

**Important**: the `branch` prop only accepts string values.
For example, if isActive is a boolean, convert it to a string first.

**Replacing Conditional Rendering:** Convert `&&` operator patterns to branch syntax.

```tsx
// Instead of: {isActive && <p>Active</p>}
<Branch branch={isActive} true={<p>Active</p>}>
  <></>
</Branch>
```

### `<Plural>` - Number-Based Rendering [#plural-numbers]

**Basic Pluralization:** Replace manual plural logic with locale-aware components.

```tsx
// Instead of: {count === 1 ? <p>1 item</p> : <p>{count} items</p>}
<Plural n={count} one={<p>1 item</p>} other={<p>{count} items</p>} />
```

Note: `n` only accepts numbers.

**With Variable Integration:** Combine with `<Num>` for formatted numbers.

```tsx
<T>
  <Plural
    n={count}
    one={
      <>
        You have <Num>{count}</Num> unread message.
      </>
    }
    other={
      <>
        You have <Num>{count}</Num> unread messages.
      </>
    }
  />
</T>
```

**Translation Context:** Use within `<T>` for translated content, standalone for raw rendering.

---

## Complete Implementation Examples

### `<Branch>` - Multi-State Logic

**Status Management:** Handle multiple conditional states with fallback.

```tsx
import { T, Branch, Var } from 'gt-next';
const status: string = 'active';
<T>
  <Branch
    branch={status}
    active={
      <p>
        User <Var>{name}</Var> is active.
      </p>
    }
    inactive={
      <p>
        User <Var>{name}</Var> is inactive.
      </p>
    }
  >
    Status unknown.
  </Branch>
</T>;
```

**Behavior:**

- `status === "active"` → renders active content
- `status === "inactive"` → renders inactive content
- Other values → renders fallback content
- Content within `<T>` is automatically translated

**Subscription Tiers:** Standalone usage without translation.

```tsx
<Branch
  branch={plan}
  free={<p>Free plan - upgrade to unlock features</p>}
  premium={<p>Premium plan - full access</p>}
  enterprise={<p>Enterprise plan - contact support</p>}
>
  No subscription detected
</Branch>
```

### `<Plural>` - Quantity-Based Content

**Message Count:** Number-dependent content with locale formatting.

```tsx
import { T, Plural, Num } from 'gt-next';

<T>
  <Plural
    n={unreadCount}
    one={
      <>
        You have <Num>{unreadCount}</Num> unread message.
      </>
    }
    other={
      <>
        You have <Num>{unreadCount}</Num> unread messages.
      </>
    }
  />
</T>;
```

**Behavior:**

- `n === 1` (locale-specific) → renders singular form
- Other values → renders plural form
- `<Num>` provides locale-aware number formatting

---

## Common Implementation Issues

### Missing Branch Values [#missing-branch]

**Critical:** Unmatched branch values fall back to children content. Ensure branch prop values match defined keys.

```tsx
<Branch
  branch={status} // If status is "pending" but no pending={} prop exists
  active={<p>Active</p>}
  inactive={<p>Inactive</p>}
>
  Status unknown. // ← This renders for unmatched values
</Branch>
```

**Rule:** Always provide fallback children for robust error handling.

### Missing Plural Forms [#plural-locale]

**Critical:** Provide required plural forms for your default locale to ensure fallback content availability.

**Minimum English Requirements:**

```tsx
<Plural
  n={count}
  one={<>One message</>}    // Required for English
  other={<>Multiple messages</>}  // Required fallback
/>

// OR simplified form
<Plural
  n={count}
  singular={<>One message</>}
  plural={<>Multiple messages</>}
/>
```

**Optimization:** Use `one`/`other` for CLDR compliance or `singular`/`plural` for simplicity.

---

## Key Principles

- **Conditional Logic:** Branch components replace ternary operators and conditional rendering with declarative syntax
- **Locale Awareness:** `<Plural>` automatically handles pluralization rules across different languages
- **Fallback Handling:** Always provide children content for unmatched conditions
- **Translation Integration:** Use within `<T>` for translated content, standalone for raw rendering

## API References

- [`<Branch>`](/docs/next/api/components/branch) - Conditional rendering options
- [`<Plural>`](/docs/next/api/components/plural) - Pluralization configuration
- [Variable Components](/docs/next/guides/variables) - Integration patterns
