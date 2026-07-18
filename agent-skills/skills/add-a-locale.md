---
name: add-a-locale
description: Add a new language (locale) to an existing gt-next or gt-react project.
---

# Add a new locale

Use this when a project already uses `gt-next` or `gt-react` and the user wants to add a
language.

## Steps

1. Add the locale code to the `locales` array. It lives in `gt.config.json`, and possibly
   also in the `withGTConfig` options (gt-next) or the `initializeGT`/`initializeGTSPA`
   call (gt-react). Update every place it appears, and keep them consistent:

   ```json
   // gt.config.json
   {
     "defaultLocale": "en",
     "locales": ["es", "fr", "ja"]
   }
   ```

   Use a supported locale code. The list is at
   https://generaltranslation.com/docs/platform/dashboard/reference/supported-locales .
   If the plugin options and `gt.config.json` disagree on `locales`, the build throws a
   conflict error, so change both to match.

2. Generate translations for the new locale:

   ```bash
   npx gt translate
   ```

   This writes a file per locale to the configured output path (for example
   `public/_gt/ja.json` for gt-next, `src/_gt/ja.json` for a Vite app). Running with API
   keys set produces real translations; without them you get source-language fallbacks you
   can fill in yourself (see `gt generate`).

3. Confirm the new file exists at the output path and is committed or generated in CI. The
   `_gt` output folder is normally gitignored, so make sure `gt translate` runs in the
   build (`"build": "npx gt translate && next build"`).

4. The language switcher (`<LocaleSelector />`) reads locales from config, so the new
   language appears automatically. No component changes are needed.

## Verify

- Run the app and select the new language from the switcher.
- Run `npx gt validate` to confirm there are no i18n errors.

## Notes

- Do not hand-edit generated `_gt/[locale].json` files unless the project deliberately
  manages translations itself. Re-running `gt translate` regenerates them.
- If the new language does not show, the selection cookie `generaltranslation.locale` may
  be stale. Clear cookies and retry.
