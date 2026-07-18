# gt-react for AI coding agents

This file is context for AI coding agents (Claude, Cursor, Copilot, and similar)
working in a codebase that **uses** `gt-react`. It is not about contributing to the
General Translation libraries themselves.

`gt-react` is automatic internationalization (i18n) for React. You wrap content in a
`<T>` component or call a translation function, and the library handles the rest. The
companion CLI is the `gt` package. For Next.js, use `gt-next` instead.

Verify anything below against the installed version before relying on it. Full docs:
https://generaltranslation.com/docs/react . A live docs MCP server also ships as
`@generaltranslation/mcp` (tools: `fetch-docs`, `list-docs`).

## Fastest correct setup

Run the setup wizard. It detects the framework and writes the config for you:

```bash
npx gt init
```

Install manually with `npm i gt-react` and `npm i -D gt`.

gt-react is used in two shapes, and the initialization differs. Follow the official
quickstart for your shape rather than guessing the provider props, since they vary by
setup:

- Server-rendered React (a framework with loaders):
  https://generaltranslation.com/docs/react/react-quickstart
- Single-page app (Vite and similar):
  https://generaltranslation.com/docs/react/react-spa-quickstart

The shared idea: create `gt.config.json`, register a `loadTranslations` function through
`initializeGT` (SSR) or `initializeGTSPA` (SPA), then use `<T>` and the string API in
your components.

```json
// gt.config.json
{
  "defaultLocale": "en",
  "locales": ["es", "fr", "ja"],
  "files": { "gt": { "output": "src/_gt/[locale].json" } }
}
```

Bundlers like Vite import translation files as modules, so keep the output inside `src/`.

## Core API

Import surface, checked against this package's entry points at the time of writing.

**From `gt-react`**:

- Components: `T`, `Var`, `Num`, `Currency`, `DateTime`, `RelativeTime`, `Branch`,
  `Plural`, `LocaleSelector`, `RegionSelector`, `GTProvider`.
- Hooks: `useGT` (translate plain strings), `useTranslations` (dictionary lookup),
  `useLocale`, `useSetLocale`, `useLocales`, `useDefaultLocale`, `useRegion`.
- Setup: `initializeGT` (server-rendered React), `initializeGTSPA` (single-page apps),
  `getTranslationsSnapshot`, `parseLocale`.
- Plain strings inside a component: `t` (a plain function) for values like an `alt` or
  `placeholder`. See `examples/vite-create-app/src/App.tsx`, which calls `t` inside the
  component for an image `alt`. Call `t` during render, not at module scope: in
  server-rendered React, module-level `t()` throws in development and falls back to the
  source string in production (it is only permitted at module scope in a single-page app,
  and even then it resolves once at import time).

**From `gt-react/macros`**: importing this module installs a global `` t`` `` template tag:

```ts
import 'gt-react/macros';
t`Hello, ${name}!`;
```

### Translating JSX and strings

```tsx
import { T, useGT } from 'gt-react';

function Welcome() {
  const gt = useGT();
  return (
    <main>
      <T>
        <h1>Welcome</h1>
        <p>Translated as a unit.</p>
      </T>
      <input placeholder={gt('Enter your email')} />
    </main>
  );
}
```

Disambiguate reused words with `context`, for example `<T context="the company">Apple</T>`
or `gt('Apple', { context: 'the company' })`.

### Dictionaries (optional)

Most apps only need `<T>` and `useGT`. A dictionary centralizes strings by id. In plain
React you pass it to the provider via the `dictionaries` prop; then look entries up:

```tsx
import { useTranslations } from 'gt-react';
const t = useTranslations();   // optional root id: useTranslations('home')
t('home.title');               // throws if the id is not in the dictionary
```

## Environment variables

API keys enable on-demand translation in development and let the CLI translate at build
time.

- Client-side dev (Vite): `VITE_GT_PROJECT_ID`, `VITE_GT_DEV_API_KEY`.
- Production build: `GT_PROJECT_ID`, `GT_API_KEY` (CI/CD only).

Dev keys start with `gtx-dev-`; production keys typically start with `gtx-api-`. Never
expose a production `GT_API_KEY` to the browser or commit it. Get keys at
https://dash.generaltranslation.com or by running `npx gt auth`.

## Local translation files

With `output` pointing at a folder, register a `loadTranslations` function. A defensive
loader keeps the app working before files exist:

```ts
// src/loadTranslations.ts
export default async function loadTranslations(locale: string) {
  try {
    const t = await import(`./_gt/${locale}.json`);
    return t.default;
  } catch {
    return {}; // fall back to source language before files are generated
  }
}
```

`src/_gt/` holds generated output, not source. By default translations load from the CDN
at runtime; these local files are opt-in and remove that CDN dependency. Two supported
workflows:

- **Commit `src/_gt/`** (what this repo's own example apps do) for a zero-config deploy:
  the files are already present, so no build-time key is needed.
- **Gitignore `src/_gt/`** and run `gt translate` in CI/build with a production `GT_API_KEY`
  so the files are regenerated before the build.

Pick one and be consistent. Either way, do not hand-edit the generated files.

## Commands

Run with `npx gt <command>` (or the installed `gt` dev dependency).

- `gt init` runs the setup wizard.
- `gt setup` uploads source files and sets the project up for translation.
- `gt translate` generates or pulls translations. Put it in the build script:
  `"build": "npx gt translate && vite build"`.
- `gt stage` submits for translation that requires human approval, `gt download` pulls
  approved results.
- `gt generate` writes a source-locale template when you manage translations yourself.
- `gt validate [files...]` scans the project and reports errors.
- `gt auth` creates API keys and a project id.

There is no `gt status` command in this version.

## Common failure modes

- **Translations do not appear, or the build crashes on a fresh clone.** This bites in the
  gitignore workflow: `loadTranslations` imports files that only exist after `npx gt translate`
  has run, so a fresh clone that ignores `src/_gt/` has none. Either commit `src/_gt/`, or
  keep it ignored and run `gt translate` before the build. In both cases wrap the dynamic
  import in `try/catch` returning `{}` (as above) so a missing file falls back to the
  source language.
- **Wrong import path in the loader.** The dynamic import must match the output directory.
  For `src/_gt` use `` import(`./_gt/${locale}.json`) ``, not a `../translations/` path.
- **`Dictionary entry <id> cannot be found`.** The id passed to `useTranslations` is not
  in the dictionary. Keep ids and dictionary entries in sync.
- **The language will not change from the switcher.** The choice is stored in the
  `generaltranslation.locale` cookie; a stale cookie overrides selection. Clear cookies.
- **Translations are slow in development.** Expected: development translates on demand.
  Production is pre-generated by `gt translate` and loads instantly.
