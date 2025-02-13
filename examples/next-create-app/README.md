# gt-next + Create Next.js App Example

This is an example of how to use gt-next with Create Next.js App. See it live [here](https://gt-next-create-next-app.vercel.app/).

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/General-Translation/gt-libraries/tree/main/examples/next-create-app)

## Cloning

To clone this example and see it in action yourself, follow the following steps:

1. Run

```bash
git clone https://github.com/General-Translation/gt-libraries.git
cd gt-libraries/examples/next-create-app
npm install
```

2. (Optional) Create a `.local.env` file and populate it with `GT_PROJECT_ID` and `GT_API_KEY`, obtainable via the GT Dashboard [here](https://generaltranslation.com/dashboard)

3. Run `npm run dev`

## Step by Step Setup

Here is a list of steps done to reach this repo state:

1. `npx create-next-app@latest`
2. `npm install gt-next gt-next-cli`
3. `npx gt-next-cli setup`
4. Add `<GTProvider>` to the `src/app/layout.tsx` file
5. Add `initGT()` to the `next.config.ts` file:

```ts
const withGT = initGT({
  defaultLocale: 'en-US',
  locales: ['en-US', 'fr', 'es', 'zh'],
});

export default withGT(nextConfig);
```

6. Create a `.local.env` file and populate it with `GT_PROJECT_ID` and `GT_API_KEY`
7. `npm run dev`

To deploy this app to production:

1. `npx gt-next-cli translate --locales es fr zh`
2. Deploy to Vercel / Render / etc..

### Local Translations

This repo is setup to use local translations in production.

To use local translations in production, follow the following additional steps:

1. Add a `loadTranslation.ts` file under `./src` with the following content:

```ts
export default async function loadTranslation(locale: string) {
  const t = await import(`../public/_gt/${locale}.json`);
  return t.default;
}
```

2. Instead of running the command in Step 2 above, run:

```bash
npx gt-next-cli translate --locales es fr zh --no-publish
```
