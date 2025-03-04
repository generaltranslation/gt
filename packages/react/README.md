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
npm install gt-next-cli --save-dev
```

## Getting Started

### Step 1: Configure Your Environment Variables

Add the following environment variables to your `.env` file:

```
GT_API_KEY="your-api-key"
GT_PROJECT_ID="your-project-id"
```

- Get your `API Key` and `Project ID` from the [General Translation Dashboard](https://generaltranslation.com).

### 2. Select languages

`<GTProvider>` is used to configure the behavior of `gt-react`. 
It should be placed as high up in your app as possible, ideally at the root.

Just pass a list of [locale codes](https://generaltranslation.com/docs/reference/supported-locales) to add them to your app.

```jsx
import { GTProvider } from "gt-react";
import MyApp from "./MyApp";

export default function App() {
  return (
    <GTProvider locales={['fr', 'zh']}> // French and Chinese support
      <MyApp />
    </GTProvider>
  );
}
```


### 3. Add the `<T>` component

Wrap any nested JSX content in the `<T>` component to make it translatable.
For more information, check out the [guide on using `<T>` components](https://generaltranslation.com/docs/react/reference/t-reference).

```jsx
import { T } from "gt-react";

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
import { T, Var } from "gt-react";

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

```bash title="shell" copy
npx gt-react-cli setup
```

**Strings:**
For strings, you can use `useGT()` for translation.
For more information, check out [this guide](/docs/react/tutorials/translating-strings).

```jsx
import { useGT } from "gt-react";

export default function Example() {
  const t = useGT();
  return (
    <p>
      {t("This gets translated.")}
    </p>
  );
}
```
## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](generaltranslation.com/docs).

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
