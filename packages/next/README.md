<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gt-next: Automatic i18n for Next.js

gt-next is a powerful internationalization library designed for Next.js applications. It replaces your existing localization library, and integrates with [generaltranslation.com](https://generaltranslation.com) for translations.

See our [docs](https://generaltranslation.com/docs) for more information including guides, examples, and API references.

## Installation

Install `gt-next` via npm:

```bash
npm install gt-next
```

Or with yarn:

```bash
yarn add gt-next
```

## Getting Started

### Step 1: Configure Your Environment Variables

Add the following environment variables to your `.env` file:

```
GT_API_KEY="your-api-key"
GT_PROJECT_ID="your-project-id"
```

- Get your `API Key` and `Project ID` from the [General Translation Dashboard](https://generaltranslation.com).

### 2. Add the `withGTConfig()` plugin

Add `withGTConfig()` to your `next.config.js` file.
You can specify the languages you want to support by passing an array of [locale codes](https://generaltranslation.com/docs/reference/supported-locales).

```js
import { withGTConfig } from 'gt-next/config';

const nextConfig = {};

export default withGTConfig(nextConfig, {
  locales: ['pt', 'es'], // Support for Portuguese and Spanish
});
```

### 3. Add the `<T>` component

Wrap any nested JSX content in the `<T>` component to make it translatable.
For more information, check out this [guide on using `<T>` components](https://generaltranslation.com/docs/next/reference/t-reference).

```jsx
import { T } from "gt-next";

export default function Example() {
  return (
    <T>
      <p>
        This gets translated.
      </p>
    </T>
  );
}
```

Use the `<Var>` component to designate JSX content that should not be translated.

```jsx
import { T, Var } from "gt-next";

export default function Example() {
  return (
    <T>
      <p>
        This gets translated. <Var>This does not.</Var>
      </p>
    </T>
  );
}
```

**Tip:**
To save time, run the setup command.
It will scan your codebase for translatable JSX and insert the `<T>` tags for you.

```bash
npx gt-next-cli setup
```

**Strings:**
For strings, you can use `useGT()` or `getGT()` for translation.
For more information, check out [this guide](https://generaltranslation.com/docs/next/tutorials/translating-strings).

## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](generaltranslation.com/docs).

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
