<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# General Translation Libraries

This monorepo contains the libraries for General Translation, a next-generation translation platform for Next.js and React applications.

Get started with General Translation at [generaltranslation.com](https://generaltranslation.com)!

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](https://generaltranslation.com/docs).

## Features

### ⚛️ Translate entire React components, not just strings

- Just wrap your content in a `<T>` component!
- No need for complex refactoring or messy function calls.

```js
export default function Page() {
  return (
    <T>
      <p>You can write any JSX as children of the {'<T>'} component.</p>
      <p>
        For example, you could write a <a href='/'>link</a> and have the text be
        translated in context.
      </p>
      <div>
        <div>
          <p>Even deeply nested components are translated in context.</p>
          <button>Click me!</button>
        </div>
      </div>
    </T>
  );
}
```

### 🔎 Includes features from existing libraries

- GT libraries also support the same features as existing libraries like `i18next`, `react-intl`, and `next-intl`.
- Features such as dictionaries, plurals, currencies, and automatic routing are all supported.

### 🔧 Developer-friendly

- Setup is simple and can be done in minutes.
- All GT libraries are open-source and work standalone.
- No more wasting time managing translation keys like `t('menu.header.title')`.
  - Just write everything in-line!

### 🧠 Free AI-powered translation service

- Our free AI-powered translation service allows you to create translations for your app in seconds.
- HTML content is re-arranged and customized according to the language.
- Translations are generated on-demand, so you can view them in real-time in development.

## Examples

See the [examples](examples) directory for some example projects that use our libraries. We currently support React and Next.js.

Simple interface for native pluralization and conditional logic:

```tsx
<Plural
  n={count}
  singular={<>There is {count} item</>}
  plural={<>There are {count} items</>}
/>
```

Support for translation at runtime:

```tsx
export default function Comment() {
  const comment = await getComment();

  return (
    <h1>Author: {comment.author}</h1>
    <Tx>
      <p>{comment.content}</p>
    </Tx>
  );
}
```

Intuitive i18n formatting syntax:

```tsx
return (
  <T>
    <h1> Your account information: </h1>
    Account balance: <Currency>{account.bal}</Currency> // Currency Formatting
    <br />
    Updated at: <DateTime>{account.updateTime}</DateTime> // Datetime Formatting
    <br />
    Transactions this month: <Num>{account.txCount}</Num> // Number Formatting
  </T>
);
```

## Libraries

See the below for links to the relevant libraries:

- [gt-next](packages/next/README.md): Automatic i18n for Next.js
- [gt-react](packages/react/README.md): Automatic i18n for React
- [generaltranslation](packages/core/README.md): Core library for General Translation
- [supported-locales](packages/supported-locales/README.md): Currently supported locales
- [gt-react-cli](packages/react-cli/README.md): CLI tool for React apps
- [gt-next-cli](packages/next-cli/README.md): CLI tool for Next.js apps

## Installation

Any of the libraries can be installed via npm, yarn, pnpm, or bun.

For example, to install `gt-next`:

```bash
npm install gt-next
yarn add gt-next
```

Usage of the libraries is documented on our [docs](https://generaltranslation.com/docs).

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
