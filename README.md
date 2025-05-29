<div align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="./apps/docs/public/gt-logo-light.svg" alt="General Translation, Inc." width="64" height="64">
  </a>
</div>

<div align="center">

# General Translation

</div>

General Translation (GT) is a **one-stop solution** for launching software in multiple languages.

The full GT stack includes:

- Open source developer libraries
- Context-aware translation APIs
- A platform for translation management

**Install the libraries in your project, add `<T>` tags, and see translations as you code:**

![Demo](./docs/public/live_translations.gif)

Full documentation, including guides, examples, and API references, can be found in the [docs](https://generaltranslation.com/docs).

Create an API key at [generaltranslation.com](https://generaltranslation.com)!

Join our [Discord community](https://discord.gg/W99K6fchSu) to get help and stay updated!

## Library Features

### ⚛️ Translate entire React components, not just strings

- Just wrap your content in a `<T>` component!
- No need for complex refactoring or managing JSON files.

```tsx
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

### 🔎 Feature parity with existing libraries

- GT libraries also support the same features as existing libraries like `next-intl` and `react-i18next`.
- Features such as dictionaries, plurals, currencies, and automatic routing are all supported.

### 🔧 Developer-friendly

- Setup is simple and can be done in minutes.
- All GT libraries are open-source and work standalone.
  - You can use your own translation provider or use our free AI-powered translation service.
- No more managing translation keys like `t('menu.header.title')`.
  - Just write everything in-line!

### 🧠 Free, context-aware AI translation service

- Translation hot reload in development
- Libraries integrate natively with our translation platform.
- Translations are generated for your app in seconds.
- HTML content is re-arranged and customized according to the language.

## Examples

See the [examples](examples) directory for some example projects that use our libraries. We currently support React and Next.js.

Simple interface for native pluralization and conditional logic:

```tsx
<Plural
  n={count}
  singular={
    <>
      There is <Num>{count}</Num> item
    </>
  }
  plural={
    <>
      There are <Num>{count}</Num> items
    </>
  }
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
    Account balance: <Currency>{account.bal}</Currency>{' '}
    {/* Currency Formatting */}
    <br />
    Updated at: <DateTime>{account.updateTime}</DateTime>{' '}
    {/* Datetime Formatting */}
    <br />
    Transactions this month: <Num>{account.txCount}</Num>{' '}
    {/* Number Formatting */}
  </T>
);
```

## Libraries

See the below for links to the relevant libraries:

- [gt-next](packages/next/README.md): Automatic i18n for Next.js
- [gt-react](packages/react/README.md): Automatic i18n for React
- [generaltranslation](packages/core/README.md): Core library for General Translation
- [supported-locales](packages/supported-locales/README.md): Currently supported locales
- [gtx-cli](packages/cli/README.md): CLI tool for React apps

## Installation

Any of the libraries can be installed via npm, yarn, pnpm, or bun.

For example, to install `gt-next`:

```bash
npm install gt-next
yarn add gt-next
```

See our [docs](https://generaltranslation.com/docs) for more information.

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
