# gt-react + Vite Create App Example

This is an example project showcasing a multilingual Vite App using `gt-react`.

[See it live here](https://example-vite-create-app.vercel.app/).

Change your browser language to see the translations in action.

- [Chrome](https://support.google.com/chrome/answer/95647)
- [Firefox](https://support.mozilla.org/en-US/kb/delete-cookies-remove-info-websites-stored)
- [Safari](https://support.apple.com/en-mn/guide/safari/sfri11471/16.0/mac/11.0)
- [Edge](https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09)

## Deploy to Vercel

One-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/General-Translation/gt-libraries/tree/main/examples/vite-create-app)

Everything works out of the box!

## Docs

See the [docs](https://generaltranslation.com/docs/react/tutorials/quickstart) for more information on how to use `gt-react` with React.

## Cloning

To clone this example and see it in action yourself, follow the following steps:

1. Run

```bash
git clone https://github.com/General-Translation/gt-libraries.git
cd gt-libraries/examples/vite-create-app
npm install
```

2. (Optional) Create a `.local.env` file and populate it with `VITE_GT_PROJECT_ID` and `VITE_GT_API_KEY`, obtainable via the GT Dashboard [here](https://generaltranslation.com/dashboard)

   - This example comes with translations for French, Spanish, and Chinese out of the box, but if you want to experiment with other locales or modify some content, you'll need to add your own API keys.

3. Run `npm run dev`

## Step by Step Setup

Here is a comprehensive list of steps done to reach this repo state:

1. `npm create vite@latest`
2. `npm install gt-react gt-react-cli`
3. `npx gt-react-cli setup`
4. Add `<GTProvider>` to the `main.tsx` file
5. (optional) Create a `.local.env` file and populate it with `VITE_GT_PROJECT_ID` and `VITE_GT_API_KEY`
   - These environment variables are needed for local translations during development. `VITE_GT_API_KEY` should be a **development** API key. A separate **production API Key** is needed for subsequent steps when deploying to production.
6. `npm run dev`

To deploy this app to production:

1. Add `GT_PROJECT_ID` and `GT_API_KEY` to your `.env.local` file
   - The `GT_API_KEY` should be a **production** API key.
2. `npx gt-react-cli translate --locales es fr zh`
3. Deploy to Vercel / Render / etc..

### Local Translations

This repo is setup to use local translations in production.

If you are following the step-by-step guide, you will also need to follow these steps to use local translations. If you omit these steps, your production app will use the GT CDN for translation files.

1. Add a `loadTranslation.ts` file under `./src` with the following content:

```ts
export default async function loadTranslation(locale: string) {
  const t = await import(`./_gt/${locale}.json`);
  return t.default;
}
```

2. Instead of running the command in Step 2 above, run:

```bash
npx gt-react-cli translate --locales es fr zh -t ./src/_gt --no-publish
```
