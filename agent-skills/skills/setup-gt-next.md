---
name: setup-gt-next
description: Set up gt-next internationalization in a Next.js App Router project from scratch.
---

# Set up gt-next from scratch

Use this when a Next.js App Router project has no i18n yet and the user wants automatic
translation with `gt-next`.

## Fastest path

Run the setup wizard and let it write the config:

```bash
npx gt init
```

It detects the framework, creates `gt.config.json`, and offers to wire up the plugin.
After it finishes, jump to "Verify" below. Do the manual steps only if the wizard is not
an option.

## Manual setup

Do every step. Skipping one is the usual reason nothing translates.

1. Install the runtime and the CLI:

   ```bash
   npm i gt-next
   npm i -D gt
   ```

2. Wrap the Next.js config with the plugin. In `next.config.ts`:

   ```ts
   import { withGTConfig } from 'gt-next/config';

   const nextConfig = {};

   export default withGTConfig(nextConfig, {
     defaultLocale: 'en',
     locales: ['es', 'fr'],
   });
   ```

   Do not put `projectId`, `apiKey`, or `devApiKey` here. Those are environment variables.

3. Create `gt.config.json` in the project root:

   ```json
   {
     "defaultLocale": "en",
     "locales": ["es", "fr"],
     "files": { "gt": { "output": "public/_gt/[locale].json" } }
   }
   ```

   Keep `locales` and `defaultLocale` consistent with the plugin options. If a key is set
   in both places with different values, the build throws a conflict error.

4. Add a `loadTranslations` file so bundled translations load. `withGTConfig` auto-detects
   `loadTranslations.[js|ts]` in the root or `src/`:

   ```ts
   // src/loadTranslations.ts
   export default async function loadTranslations(locale: string) {
     try {
       const t = await import(`../public/_gt/${locale}.json`);
       return t.default;
     } catch {
       return {};
     }
   }
   ```

   The `try/catch` matters: the files under `public/_gt/` do not exist until `gt translate`
   runs, and that folder is gitignored, so a bare import crashes on a fresh clone.

5. Add `public/_gt/` to `.gitignore`.

6. Wrap the app with `GTProvider` at the root layout:

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

7. Wrap content in `<T>` and add a language switcher:

   ```tsx
   import { T, LocaleSelector } from 'gt-next';

   export default function Page() {
     return (
       <main>
         <LocaleSelector />
         <T>
           <h1>Welcome</h1>
           <p>This is translated automatically.</p>
         </T>
       </main>
     );
   }
   ```

8. Add API keys for on-demand translation in development. Create `.env.local`:

   ```bash
   GT_PROJECT_ID="your-project-id"
   GT_DEV_API_KEY="gtx-dev-your-dev-key"
   ```

   Get keys with `npx gt auth` or at https://dash.generaltranslation.com . Never expose
   `GT_API_KEY` to the browser or commit it. A dev key present with `NODE_ENV=production`
   makes the build throw.

9. Add translation generation to the build script so production is pre-translated:

   ```json
   { "scripts": { "build": "npx gt translate && next build" } }
   ```

## Verify

- Run the dev server and switch locales with the selector. In development the first switch
  to a new language may show a brief loading state; that is on-demand translation.
- Run `npx gt validate` to check the project for i18n errors.

For plain strings (a `placeholder`, `aria-label`, or `alt`), use `useGT()` in client or
sync server components, or `getGT()` from `gt-next/server` in async server components. Do
not wrap non-JSX strings in `<T>`.
