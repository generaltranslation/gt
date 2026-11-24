<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + gt-i18n + Electron Example

An Electron app in several languages. The main process translates its menu with `gt-i18n`, the window translates its page with `gt-react`, and one locale drives both: changing it in either place changes the page and the menu together, without a reload.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt
corepack pnpm install
corepack pnpm turbo run build --filter=electron-example^...
```

To run the example on its own, copy this directory out of the monorepo and replace the three `workspace:*` versions with published ones.

### Run

```bash
cd examples/electron
pnpm start
```

The first run downloads the Electron binary, so it needs a network connection. `pnpm start` builds the page into `dist/` and the main process into `dist-electron/`, then opens the app. It builds from the committed translation files, so it needs no account or API key.

## How it works

The main process owns the locale. The window never chooses one: it is told.

- **`src/main/i18n.ts`** calls `initializeGT()` from `gt-i18n/standalone` with the locale saved from the last run, then the system's languages, and builds the menu with `` t`...` ``.
- **`src/main/main.ts`** changes locale with `setLocale()`, which switches once the next locale's translations have loaded. In `onLocaleChange()` it builds the menu again, saves the locale, and tells every window. A menu is made of strings, so it has to be built again; the window's components are not, and update on their own.
- **`src/main/preload.cts`** exposes the locale to the page as `window.gt`: read it, ask the main process to change it, and subscribe to changes.
- **`src/renderer/App.tsx`** reads `window.gt` with `useSyncExternalStore` and passes the locale to `<GTProvider locale={locale}>`. Given no `translations`, the provider loads each locale's translations itself and keeps the current locale on screen until the next one has loaded.
- **`gt.config.json`** has one `src` pattern that covers both processes, so they share the translation files in `src/_gt/`. The main process reads them from disk; the page imports them.

## Translation files

The files in `src/_gt/` are hand-written in this example. After changing source text, run `pnpm generate`: it rewrites `en.json` from the source and adds each new message to `es.json` and `fr.json` with its English text, for you to translate. `pnpm exec gt generate --check` fails when the files are out of date, which is useful in CI. To have General Translation translate them, sign in with `npx gt login` and run `npx gt translate --project-id <your-project-id>`.

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [General Translation docs](https://generaltranslation.com/docs)
