# Migration Patterns for Existing i18n Projects

**Objective**: Transform existing i18n implementations to `gt-next` using systematic migration strategies.

## Core Migration Principles

### Library Replacement Requirements

- Replace existing i18n library hooks/functions with `gt-next` equivalents
- Transform string keys to inline content or maintain dictionary structure
- Preserve existing translation content during transition

## Prerequisites

The project should be setup with `gt-next`. See the guide on setting up gt-next in a Next.js project.

## Migration Strategy Implementation

**Objective**: Full transformation from existing i18n library to `gt-next` with string key elimination.

**Hook replacement pattern**:

- Replace old i18n library hooks/functions with `gt-next` equivalents
- Transform string keys → inline content

**Implementation transformation**:

**Legacy pattern**:

```json
{
  "hello": {
    "description": "Hello, world!"
  }
}
```

```tsx
export default function MyComponent() {
  const { t } = useTranslation();
  return <div>{t('hello.description')}</div>;
}
```

**Migrated implementations**:

**Option A - Hook-based**:

```tsx
export default function MyComponent() {
  const t = useGT();
  return <div>{t('Hello, world!')}</div>;
}
```

**Option B - Component-based**:

```tsx
export default function MyComponent() {
  return (
    <T>
      <div>Hello, world!</div>
    </T>
  );
}
```

**Requirements**: Systematic replacement of all legacy i18n library instances.

## Migration Implementation Guidelines

### Primary Pattern Preference

**Rule**: Prioritize `useGT()` hook, `getGT()` function, and `<T>` component usage whenever possible.

**Benefits**:

- Enhanced content editability
- Improved code readability
- Contextual content management

### Dictionary Hook Usage

**Rule**: Only apply `useDict()` and `getDict()` during migration when necessary.
