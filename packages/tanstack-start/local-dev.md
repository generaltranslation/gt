# Instructions for local development setup

- Follow [quick start](https://tanstack.com/start/latest/docs/framework/react/quick-start) for TanStack Start template.
- Build & link `gt-tanstack-start`
- `gt.config.json`:

```json
{
  "defaultLocale": "en",
  "locales": ["fr", "zh"],
  "files": {
    "gt": {
      "output": "src/_gt/[locale].json"
    }
  }
}
```

- env:

```env
VITE_GT_PROJECT_ID=your-project-id
VITE_GT_API_KEY=your-api-key
```

- `loadTranslations.ts`:

```ts
export async function loadTranslations(locale: string) {
  const translations = await import(`./src/_gt/${locale}.json`);
  return translations.default;
}
```

- `start.ts` middleware setup:

```ts
import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { gtMiddleware } from 'gt-tanstack-start/middleware';

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, gtMiddleware],
}));
```

- `__root.tsx` minimum setup:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import gtConfig from '../../gt.config.json';
import { loadTranslations } from '../../loadTranslations';
import Header from '../components/Header';

import appCss from '../styles.css?url';
import {
  getTranslationsSnapshot,
  initializeGT,
  LocaleSelector,
  GTProvider,
} from 'gt-tanstack-start';
import { createServerFn } from '@tanstack/react-start';
import { getLocale } from 'gt-tanstack-start/server';

initializeGT({
  ...gtConfig,
  projectId: import.meta.env.VITE_GT_PROJECT_ID,
  devApiKey: import.meta.env.VITE_GT_DEV_API_KEY,
  loadTranslations,
});

const loadRootData = createServerFn({ method: 'GET' }).handler(async () => {
  const locale = getLocale();
  return {
    translations: await getTranslationsSnapshot(locale),
    locale,
  };
});

export const Route = createRootRoute({
  loader: () => loadRootData(),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { translations, locale } = Route.useLoaderData();
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <GTProvider locale={locale} translations={translations}>
          <Header />
          <LocaleSelector />
          {children}
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </GTProvider>
        <Scripts />
      </body>
    </html>
  );
}
```

## Some notes

- If you do local translations, make sure the `json` files are in the `src/` directory, not `public/`.
- I haven't set up `gt` yet, so import `<T>` from `gt-react` and when you wrap `gt()` around a string, wrap it in `msg()` from `gt-react` as well for registration
