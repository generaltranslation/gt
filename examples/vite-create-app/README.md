<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gt-react + Vite Create App Example

This is an example project showcasing a multilingual Vite App using [`gt-react`](https://generaltranslation.com/docs/react).

[See it live here](https://example-vite-create-app.vercel.app/).

## Deploy to Vercel

One-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/vite-create-app)

Everything works out of the box!

## Docs

See the [docs](https://generaltranslation.com/docs/react/tutorials/quickstart) for more information on how to use `gt-react` with React.

## Cloning

To clone this example and see it in action yourself, follow the following steps:

1. Run

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt-libraries/examples/vite-create-app
npm install
```

2. (Optional) Create a `.local.env` file and populate it with `VITE_GT_PROJECT_ID` and `VITE_GT_API_KEY`, obtainable via the GT Dashboard [here](https://generaltranslation.com/dashboard)

   - This example comes with translations for French, Spanish, and Chinese out of the box, but if you want to experiment with other locales or modify some content, you'll need to add your own API keys.

3. Run `npm run dev`

## Step by Step Setup

Here is a comprehensive list of steps done to reach this repo state:

1. `npm create vite@latest`
2. `npm install gt-react gtx-cli`
3. `npx gtx-cli setup && npx-gtx-cli init`
   - Setup will automatically add the `<T>` components to your app.
   - When calling `init` specify "remote" as the location of your language files and en, zh, and fr as your locales.
4. Import `gt.config.json` and wrap your app in `<GTProvider {...config}>` in the `main.tsx` file.

```js
import { GTProvider } from 'gt-react';
import config from '../gt.config.json'
...
  <React.StrictMode>
    <GTProvider {...config}>
      <App />
    </GTProvider>
  </React.StrictMode>
...
```

5. (optional) Create a `.local.env` file and populate it with `VITE_GT_PROJECT_ID` and `VITE_GT_API_KEY`.
   - These environment variables are needed for local translations during development. `VITE_GT_API_KEY` should be a **development** API key. A separate **production API Key** is needed for subsequent steps when deploying to production.
6. `npm run dev`

To deploy this app to production:

1. Add `GT_PROJECT_ID` and `GT_API_KEY` to your `.env` file
   - The `GT_API_KEY` should be a **production** API key.
2. Add `npx gtx-cli translate` to your build step before the build command.
3. Deploy to Vercel / Render / etc..

### Local Translations

This repo is setup to use local translations in production.

If you are following the step-by-step guide, you will also need to follow these steps to use local translations. If you omit these steps, your production app will use the GT CDN for translation files.

1. Add a `loadTranslation.ts` file under `./src` with the following content:

```ts
export default async function loadTranslations(locale: string) {
  const t = await import(`./_gt/${locale}.json`);
  return t.default;
}
```

Add this to your `<GTProvider/>`

```js
import { GTProvider } from 'gt-react';
import config from '../gt.config.json'
import loadTranslations from './loadTranslations';
...
  <React.StrictMode>
    <GTProvider loadTranslations={loadTranslations} {...config}>
      <App />
    </GTProvider>
  </React.StrictMode>
...
```

2. Instead of running the command in Step 2 above, run:

- When calling `init` specify "local" as the location of your language files and en, zh, and fr as your locales

```bash
npx gtx-cli translate
```

For more information on local translation, check out our [guide on local translation](https://generaltranslation.com/docs/react/reference/local-tx).
