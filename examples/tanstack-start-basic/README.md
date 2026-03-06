<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gt-tanstack-start + TanStack Start Example

A multilingual TanStack Start app using `gt-tanstack-start` for internationalization with local translations.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/tanstack-start-basic
npm install
```

### Generate translations

```bash
npx gt translate
```

### Run the dev server

```bash
npm run dev
```

Visit [localhost:3000](http://localhost:3000) and use the locale selector to switch languages.

## How it works

1. **`initializeGT()`** in `__root.tsx` sets up the i18n manager with local translations
2. **`getTranslations()`** loads the right translation file in the root loader
3. **`<GTProvider>`** provides translations to all child components
4. **`<T>`** wraps JSX content for automatic translation
5. **`<LocaleSelector>`** lets users switch languages

## Key files

- `src/routes/__root.tsx` — GT initialization, root loader, and provider setup
- `src/routes/index.tsx` — Home page with translated content
- `src/routes/about.tsx` — About page with translated content
- `loadTranslations.ts` — Dynamic import loader for translation JSON files
- `gt.config.json` — GT configuration (locales, output path)
- `src/_gt/*.json` — Generated translation files

## Notes

- Import `<T>` from `gt-react` (not `gt-tanstack-start`) so the `gt` CLI can detect translatable content
- Translation files must be in `src/` (not `public/`) for Vite's dynamic imports to work
- The `gt` CLI requires `gt-react` as a direct dependency to scan for `<T>` components
