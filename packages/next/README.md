<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gt-next: Automatic i18n for Next.js

gt-next is a powerful internationalization library designed for Next.js applications. It replaces your existing localization library, and integrates with [generaltranslation.com](https://generaltranslation.com) for translations.

See our [docs](https://www.generaltranslation.com/docs) for more information including guides, examples, and API references.

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

- Get your `API Key` and `Project ID` from the [General Translation Dashboard](https://www.generaltranslation.com).

### Step 2: Add the `<GTProvider>`

Add the `<GTProvider>` component below your root `layout.tsx` `<html>` tag to add translations for client-side
content, and set the <html> `lang` attribute using `getLocale()`.

```jsx
import { GTProvider } from 'gt-next';
import { getLocale } from 'gt-next/server';

export default async function RootLayout({ children }) {
  const lang = await getLocale();

  return (
    <html lang={lang}>
      <body>
        <GTProvider>{children}</GTProvider>
      </body>
    </html>
  );
}
```

### Step 3: Translate Content with `<T>`

The `<T>` component is the simplest way to translate inline JSX content.

```jsx
import { T } from 'gt-next';

export default function HomePage() {
  return (
    <T id='greeting'>
      <p>Hello, world!</p>
    </T>
  );
}
```

If you have an existing project you would like to internationalize, you can use the `gt-react-cli` tool for initial setup.

```bash
npm install gt-react-cli
npx gt-react-cli scan
```

## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](www.generaltranslation.com/docs).

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
