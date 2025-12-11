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
npm install gtx-cli --save-dev
```

## Getting Started

Follow the [Quick Start Guide](https://generaltranslation.com/docs/react) or run the setup wizard: `npx gtx-cli init` and add the [`<GTProvider>`](https://generaltranslation.com/en-US/docs/react#gtprovider) to your app.

Translate everything inside of the `<T>` component.

```jsx
<T>
  <p>This gets translated!</p>
  <div>This also gets translated!</divs>
</T>
```

## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](generaltranslation.com/docs).

## Features

### Jsx Translation

```jsx
<T>
  Translate anything inside of a {'<T>'} component!
  <div>Including nested structures</div>
</T>
```

### Inline string translation

```jsx
function MyComponent() {
  const gt = useGT();
  return <>{gt('Strings as well!')}</>;
}
```

### Dictionary translation

```json
{
  "key": "Hello, World!"
}
```

```jsx
function MyComponent() {
  const t = useTranslations();
  return <>{t('key')}</>;
}
```

### Pluralization

Support for pluralization and conditional branching

```jsx
<T>
  <Plural
    n={count}
    singular="There is 1 person"
    plural={<>There are <Num>{count}</Num> people}
  />
</T>
```

### Formatting

Support for number, currency, date time, and dynamic variables

```jsx
<Num options={{ style: 'currency', currency: 'EUR' }}>{1000}</Num>
```

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
