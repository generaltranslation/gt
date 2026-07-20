<p align="center">
  <a href="https://generaltranslation.com/docs/tanstack-start">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/tanstack-start"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-tanstack-start

Automatic i18n for TanStack Start.

**EXPERIMENTAL**

This package is experimental and may be subject to breaking changes.

It is not yet recommended for production use.

## Installation

```bash
npm install gt-tanstack-start
npm install gt --save-dev
```

## Quick Start

```bash
npx gt init
```

```jsx
import { T } from 'gt-tanstack-start';

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/tanstack-start) for guides and API reference.

## Server APIs

Call `initializeGT()` during application setup as usual. In the server build,
it prepares the request condition store that middleware populates per request.

Register `gtMiddleware` once to make request-scoped locale state available to
server functions, server routes, loaders, and SSR:

The middleware is required only for APIs imported from
`gt-tanstack-start/server`. Existing components and hooks continue to read
conditions from `GTProvider` context without requiring middleware.

```ts
// src/start.ts
import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { gtMiddleware } from 'gt-tanstack-start/server';

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, gtMiddleware],
}));
```

Server-only code can then access the current request without passing the locale
through every function:

```ts
import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
  getTranslations,
} from 'gt-tanstack-start/server';

const locale = getLocale();
const enableI18n = getEnableI18n();
const gt = await getGT();
```
