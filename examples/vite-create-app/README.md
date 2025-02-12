# gt-react + Vite Create App Example

This is an example of how to use gt-react with Vite Create App.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/General-Translation/gt-libraries/tree/main/examples/vite-create-app)

## Cloning

To clone this example and see it in action yourself, follow the following steps:

1. Run

```bash
git clone https://github.com/General-Translation/gt-libraries.git
cd gt-libraries/examples/vite-create-app
npm install
```

2. (Optional) Create a `.local.env` file and populate it with `VITE_GT_PROJECT_ID` and `VITE_GT_API_KEY`, obtainable via the GT Dashboard [here](https://generaltranslation.com/dashboard)

3. Run `npm run dev`

## Step by Step Setup

Here is a list of steps done to reach this repo state:

1. `npm create vite@latest`
2. `npm install gt-react gt-react-cli`
3. `npx gt-react-cli setup`
4. Add `<GTProvider>` to the `main.tsx` file
5. Create a `.local.env` file and populate it with `VITE_GT_PROJECT_ID` and `VITE_GT_API_KEY`
6. `npm run dev`

To deploy this app to production:

1. Add `GT_PROJECT_ID` and `GT_API_KEY` to your `.env.local` file
2. `npx gt-react-cli translate --locales es fr zh`
3. Deploy to Vercel / Render / etc..

### Local Translations

This repo is setup to use local translations in production.

To use local translations in production, follow the following additional steps:

1. Add a `loadTranslation.ts` file under `./src` with the following content:

```ts
export default async function loadTranslation(locale: string) {
  const t = await import(`./_gt/${locale}.json`);
  return t.default;
}
```

2. Instead of running the command in Step 2 above, run:

```bash
npx gt-react-cli translate --locales es fr zh --translations-dir ./src/_gt --no-publish
```
