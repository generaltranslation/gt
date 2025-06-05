# Next.js App Router with gt-next Setup Guide

## Required libraries

Install the `gt-next` and `gtx-cli` libraries using the project's package manager:

```bash
npm i gt-next
npm i --save-dev gtx-cli
```

## Required Configuration: `withGTConfig`

**Purpose**: Initialize the gt-next SDK in Next.js applications.

**Implementation**: Configure `withGTConfig` in your `next.config.[js|ts]` file as the default export wrapper:

```tsx title="next.config.ts"
import { withGTConfig } from 'gt-next/config';

const nextConfig = {
  // Your next.config.ts options
};

export default withGTConfig(nextConfig, {
  // Additional GT configuration options
});
```

**Reference**: [withGTConfig API Reference](/docs/next/api/config/withGTConfig)

## Required Provider: `GTProvider`

**Purpose**: Provides internationalization context to client-side components in Next.js applications.

**Functionality**: Works in conjunction with `withGTConfig` to provide:

- User locale management
- Locale-specific translations
- Context for `useGT` hook
- Context for `useDict` hook

**Setup Steps**:

1. **Root Layout Integration**: Add `GTProvider` to your application's root layout, positioned as high as possible in the component tree, within `<html>` and `<body>` elements:

```tsx copy title="src/layout.tsx"
import { GTProvider } from 'gt-next';
import { getLocale } from 'gt-next/server';

export default async function RootLayout({ children }) {
  return (
    <html lang={await getLocale()}>
      <body>
        <GTProvider>{children}</GTProvider>
      </body>
    </html>
  );
}
```

Make sure to include `lang={await getLocale()}` in the `<html>` props.

**Note**: For applications with multiple root layouts, include `GTProvider` in each layout.

2. **Configuration File**: Create a [`gt.config.json`](/docs/cli/reference/config) file in the project root for configuring both `gtx-cli` and `gt-next`:

   ```json title="gt.config.json" copy
   {
     "defaultLocale": "en",
     "locales": ["fr", "es"]
   }
   ```

   **Customization**: Set `defaultLocale` and `locales` array to match project requirements. Reference [supported locales](/docs/platform/locale-strings) for valid values.

   **Auto-Detection**: `withGTConfig` automatically detects and uses this configuration file.

## Content Translation Methods

Once setup is complete, implement internationalization using these translation approaches:

### JSX Translation: `<T>` Component

**Purpose**: Primary component for translating JSX content.

**Basic Usage**: Wrap translatable JSX content:

```tsx
import { T } from 'gt-next';
<T>
  <div>Your content</div>
</T>;
```

**Dynamic Content**: Use variable components for dynamic values:

```tsx
import { T, Var } from 'gt-next';

<T>
  <div>
    Hello, <Var>{name}</Var>!
  </div>
</T>;
```

**Reference**: Call the tool for the guide on translating JSX content for more information.

### String Translation: `useGT` Hook

**Purpose**: React hook returning a translation function for string content.

**Client-Side Usage**:

```tsx
'use client'; // must include use client when using useGT
import { useGT } from 'gt-next/client';

export default function MyComponent() {
  const t = useGT();
  return t('Hello, world!');
}
```

**Context Restriction**: Client-side components only. Use async `getGT()` function for server-side components.

**Reference**: Call the tool for the guide on client-side components or server-side components for more information.

## Setup Summary

**Core Components Configured**:

- `withGTConfig`: SDK initialization in Next.js configuration
- `GTProvider`: Context provider for internationalization
- `gt.config.json`: Locale and translation configuration
- Translation methods: `<T>` component for JSX, `useGT` hook & `getGT` for strings

**Result**: Fully internationalized Next.js application with hot-reload translation support.
