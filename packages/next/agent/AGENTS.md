# gt-next for AI coding agents

This file is context for AI coding agents (Claude, Cursor, Copilot, and similar)
working in a codebase that **uses** `gt-next`. It is not about contributing to the
General Translation libraries themselves.

`gt-next` is automatic internationalization (i18n) for Next.js. You wrap content in
a `<T>` component or call a translation function, and the library handles extraction,
translation, and locale routing. The companion CLI is the `gt` package.

Verify anything below against the installed version before relying on it. Full docs:
https://generaltranslation.com/docs/next . A live docs MCP server also ships as
`@generaltranslation/mcp` (tools: `fetch-docs`, `list-docs`).

## Fastest correct setup

Run the setup wizard. It detects the framework and writes the config for you:

```bash
npx gt init
```

If you set things up by hand instead, do all of these, in order. Missing any one is
the usual reason translations do not appear.

1. Install: `npm i gt-next` and `npm i -D gt`.
2. Wrap the Next config with the plugin in `next.config.ts`:

   ```ts
   import { withGTConfig } from 'gt-next/config';

   const nextConfig = {};

   export default withGTConfig(nextConfig, {
     defaultLocale: 'en',
     locales: ['es', 'fr', 'ja'],
   });
   ```

   `locales` and `defaultLocale` can live here or in `gt.config.json` (see next step),
   but not disagree in both. You **cannot** pass `projectId`, `apiKey`, or `devApiKey`
   here; those are environment variables only.

3. Create `gt.config.json` in the project root:

   ```json
   {
     "defaultLocale": "en",
     "locales": ["es", "fr", "ja"],
     "files": { "gt": { "output": "public/_gt/[locale].json" } }
   }
   ```

4. Add a `GTProvider` at the root layout so the app can read translations:

   ```tsx
   // app/layout.tsx
   import { GTProvider, useLocale } from 'gt-next';

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     const locale = useLocale();
     return (
       <html lang={locale}>
         <body>
           <GTProvider>{children}</GTProvider>
         </body>
       </html>
     );
   }
   ```

5. Wrap content you want translated:

   ```tsx
   import { T } from 'gt-next';

   export default function Page() {
     return (
       <T>
         <h1>Welcome</h1>
         <p>This is translated as a unit.</p>
       </T>
     );
   }
   ```

## Core API

Import surface, checked against this package's entry points at the time of writing.

**From `gt-next`** (works in client and synchronous server components):

- Components: `T`, `Var`, `Num`, `Currency`, `DateTime`, `RelativeTime`, `Branch`,
  `Plural`, `LocaleSelector`, `RegionSelector`, `GTProvider`.
- Hooks: `useGT` (translate plain strings), `useTranslations` (dictionary lookup),
  `useLocale`, `useLocales`, `useDefaultLocale`, `useRegion`.
- Client-only hook: `useSetLocale` (changes the active locale). It is not exported from
  the server (`react-server`) entry, so call it only from client components.

**From `gt-next/server`** (async App Router server components only):

- `getGT` (async string translation), `getTranslations` (async dictionary lookup),
  `getLocale`, `getRegion`, `getLocaleDirection`, `registerLocale`, `tx`, `Tx`.

**From `gt-next/config`**: `withGTConfig`.
**From `gt-next/middleware`**: `createNextMiddleware`.

### Translating strings

`<T>` is for JSX. For plain strings (a `placeholder`, `aria-label`, `alt`, or a value
in code) use the string API:

```tsx
// Client or sync server component
import { useGT } from 'gt-next';
const gt = useGT();
<input placeholder={gt('Enter your email')} />;
```

```tsx
// Async server component (hooks are not allowed there)
import { getGT } from 'gt-next/server';
const gt = await getGT();
return <p>{gt('Hello')}</p>;
```

Disambiguate reused words with `context`, for example `gt('Apple', { context: 'the company' })`
or `<T context="the company">Apple</T>`.

### Dictionaries (optional)

Most apps only need `<T>` and `useGT`. A dictionary centralizes strings by id.

- Register it via `withGTConfig(nextConfig, { dictionary: './dictionary.json' })`, or
  drop a `dictionary.[js|ts|json]` in the project root or `src/` for auto-detection.
- Look entries up by id:

  ```tsx
  import { useTranslations } from 'gt-next'; // or getTranslations from 'gt-next/server'
  const t = useTranslations();       // optional root id: useTranslations('home')
  t('home.title');                   // throws if the id is not in the dictionary
  ```

### Middleware and localized routing (optional)

Only needed if you want locale-prefixed URLs (`/es/about`). Create the middleware file
(`proxy.ts` on Next.js 16+, `middleware.ts` on Next.js 15 and earlier):

```ts
import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware();

export const config = { matcher: ['/((?!api|static|.*\\..*|_next).*)'] };
```

Localized routing also expects your routes under `app/[locale]/` and a `getLocale.ts`.
See the middleware guide before adopting it.

## Environment variables

API keys enable on-demand translation in development and let the CLI translate at build
time. They are read from the environment, never passed as plugin options.

- `GT_PROJECT_ID` (or `NEXT_PUBLIC_GT_PROJECT_ID`)
- `GT_API_KEY` for production (typically starts with `gtx-api-`, CI/CD only)
- `GT_DEV_API_KEY` (or `NEXT_PUBLIC_GT_DEV_API_KEY`) for development (starts with `gtx-dev-`)

Rules the build enforces: never expose `GT_API_KEY` to the browser or commit it. A dev
key present with `NODE_ENV=production` makes the build throw. Get keys at
https://dash.generaltranslation.com or by running `npx gt auth`.

## Local translation files

When `output` points at a folder (for example `public/_gt/[locale].json`), add a
`loadTranslations` file. `withGTConfig` auto-detects `loadTranslations.[js|ts]` in the
root or `src/`:

```ts
// src/loadTranslations.ts
export default async function loadTranslations(locale: string) {
  try {
    const t = await import(`../public/_gt/${locale}.json`);
    return t.default;
  } catch {
    return {}; // fall back to source language before files are generated
  }
}
```

`public/_gt/` holds generated output, not source. By default translations load from the
CDN at runtime; these local files are opt-in and remove that CDN dependency. Two supported
workflows:

- **Commit `public/_gt/`** (what this repo's own example apps do) for a zero-config deploy:
  the files are already present, so no build-time key is needed.
- **Gitignore `public/_gt/`** and run `gt translate` in CI/build with a production
  `GT_API_KEY` so the files are regenerated before `next build`.

Pick one and be consistent. Either way, do not hand-edit the generated files.

## Commands

Run with `npx gt <command>` (or the installed `gt` dev dependency).

- `gt init` runs the setup wizard.
- `gt setup` uploads source files and sets the project up for translation.
- `gt translate` generates or pulls translations. Put it in the build script:
  `"build": "npx gt translate && next build"`.
- `gt stage` submits for translation that requires human approval, `gt download` pulls
  approved results.
- `gt generate` writes a source-locale template when you manage translations yourself.
- `gt validate [files...]` scans the project and reports errors.
- `gt auth` creates API keys and a project id.

There is no `gt status` command in this version.

## Common failure modes

- **Translations do not appear, or the build crashes on a fresh clone.** This bites in the
  gitignore workflow: `loadTranslations` imports files that only exist after `npx gt translate`
  has run, so a fresh clone that ignores `public/_gt/` has none. Either commit `public/_gt/`,
  or keep it ignored and run `gt translate` before `next build`. In both cases wrap the
  dynamic import in `try/catch` returning `{}` (as above) so a missing file falls back to
  the source language.
- **`loadTranslations` file exists but nothing loads, dev throws.** The file must expose
  the loader as its default export or as a named `loadTranslations` export. If neither is
  present, development throws.
- **`Dictionary entry <id> cannot be found`.** The id passed to `useTranslations`/
  `getTranslations` is not in the dictionary. Keep ids and dictionary entries in sync.
- **Build fails with a configuration conflict.** The same key is set in both
  `gt.config.json` and the `withGTConfig` options with different values. Precedence is
  options > environment variables > `gt.config.json` > defaults; make them agree.
- **The language will not change from the switcher.** The choice is stored in the
  `generaltranslation.locale` cookie; a stale cookie overrides selection. Clear cookies.
- **Translations are slow in development.** Expected: development translates on demand.
  Production is pre-generated by `gt translate` and loads instantly.
