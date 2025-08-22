<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gt-react + create-react-app

This is an example project showcasing a create-react-app boilerplate app using [`gt-react`](https://generaltranslation.com/docs/react).

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

[See it live here](https://example-create-react-qhttbgovz-general-translation.vercel.app).

Change your browser language to see the translations in action.

- [Chrome](https://support.google.com/chrome/answer/95647)
- [Firefox](https://support.mozilla.org/en-US/kb/delete-cookies-remove-info-websites-stored)
- [Safari](https://support.apple.com/en-mn/guide/safari/sfri11471/16.0/mac/11.0)
- [Edge](https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09)

## Deploy to Vercel

One-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/example-create-react-app)

Everything works out of the box!

## Docs

See the [docs](https://generaltranslation.com/docs/react/tutorials/quickstart) for more information on how to use `gt-react` with React.

## Cloning

To clone this example and see it in action yourself, follow the following steps:

1. Run

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt-libraries/examples/create-react-app
npm install
```

2. (Optional) Create a `.env` file and populate it with `REACT_APP_GT_PROJECT_ID` and `REACT_APP_GT_API_KEY`, obtainable via the GT Dashboard [here](https://generaltranslation.com/dashboard)
   - This example comes with translations for French, Spanish, and Chinese out of the box, but if you want to experiment with other locales or modify some content, you'll need to add your own API keys.

3. Run `npm run dev`

## Step by Step Setup

Here is a comprehensive list of steps done to reach this repo state:

1. `npx create-react-app create-react-app`
2. `npm install gt-react gtx-cli`
3. `npx gtx-cli setup --config ./src/gt.config.json && npx-gtx-cli init`
   - Setup will automatically add the `<T>` components to your app.
   - When calling `init` specify "remote" as the location of your language files and en, zh, and fr as your locales.
4. Import `gt.config.json` and wrap your app in `<GTProvider>` in the `index.js` file.

```js
import { GTProvider } from 'gt-react';
import config from './gt.config.json'
...
  <React.StrictMode>
    <GTProvider {...config}>
      <App />
    </GTProvider>
  </React.StrictMode>
...
```

5. (optional) Create a `.env` file and populate it with `REACT_APP_GT_PROJECT_ID` and `REACT_APP_GT_API_KEY`.
   - These environment variables are needed for local translations during development. `REACT_APP_GT_API_KEY` should be a **development** API key. A separate **production API Key** is needed for subsequent steps when deploying to production.
6. `npm run dev`
7. (optional) Add the [`<LocaleSelector]

To deploy this app to production:

1. Add `GT_PROJECT_ID` and `GT_API_KEY` to your `.env` file
   - The `GT_API_KEY` should be a **production** API key.
2. Add `npx gtx-cli translate` to your build step before the build command.
3. Deploy to Vercel / Render / etc..

### Local Translations

This repo is setup to use local translations in production.

If you are following the step-by-step guide, you will also need to follow these steps to use local translations. If you omit these steps, your production app will use the GT CDN for translation files.

1. Add a `loadTranslation.js` file under `./src` with the following content:

```js
export default async function loadTranslations(locale) {
  const t = await import(`./locales/${locale}.json`);
  return t.default;
}
```

Add this to your `<GTProvider/>`

```js
import { GTProvider } from 'gt-react';
import config from './gt.config.json'
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

For more information on local translation, check out our [guide on local translation](https://generaltranslation.com/docs/next/guides/local-tx).
