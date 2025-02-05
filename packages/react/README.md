<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gt-react: Automatic i18n for React

gt-react is a powerful internationalization library designed for React applications. It replaces your existing localization library, and integrates with [generaltranslation.com](https://generaltranslation.com) for translations.

See our [docs](https://generaltranslation.com/docs) for more information including guides, examples, and API references.

## Installation

Install `gt-react` via npm:

```bash
npm install gt-react
```

Or with yarn:

```bash
yarn add gt-react
```

## Getting Started

### Step 1: Configure Your Environment Variables

Add the following environment variables to your `.env` file:

```
GT_API_KEY="your-api-key"
GT_PROJECT_ID="your-project-id"
```

- Get your `API Key` and `Project ID` from the [General Translation Dashboard](https://generaltranslation.com).

### Step 2: Add the `<GTProvider>`

Add the `<GTProvider>` component at the root of your application.

```jsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GTProvider
      projectId={GT_PROJECT_ID}
      devApiKey={GT_API_KEY}
    >
      <App />
    </GTProvider>
  </StrictMode>
);
```

### Step 3: Translate Content with `<T>`

The `<T>` component is the simplest way to translate inline JSX content.

```jsx
import { T } from 'gt-react';

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

This will scan your project for all the text content that needs to be translated, and automatically wrap them in `<T>` and `<Var>` components.

## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](generaltranslation.com/docs).

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
