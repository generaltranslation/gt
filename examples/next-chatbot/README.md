<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gt-next + Vercel AI Chatbot

This is an example project showcasing a multilingual AI Chatbot using `gt-next`.

This project was using the [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot).

[See it live here](https://example-ai-chatbot-ten.vercel.app/).

## Deploy to Vercel

One-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/next-chatbot)

Everything works out of the box!

## Docs

See the [docs](https://generaltranslation.com/docs/next/tutorials/quickstart) for more information on how to use `gt-next` with Next.js.

## Cloning

To clone this example and see it in action yourself, follow the following steps:

1. Run

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt-libraries/examples/next-chatbot
npm install
```

2. (Optional) Create a `.local.env` file and populate it with `GT_PROJECT_ID` and `GT_API_KEY`, obtainable via the GT Dashboard [here](https://generaltranslation.com/dashboard)

   - This example comes with translations for French, Spanish, and Chinese out of the box, but if you want to experiment with other locales or modify some content, you'll need to add your own API keys.

3. Run `npm run dev`

## Step by Step Setup

Here is a list of steps done to reach this repo state:

1. `git clone -b base https://github.com/General-Translation/ai-chatbot.git && cd ai-chatbot`
2. `npm install gt-next gtx-cli`
3. `npx gtx-cli setup && npx-gtx-cli init`
   - Setup will automatically add the `<T>` components to your app.
   - When calling `init` specify "remote" as the location of your language files and en, zh, and fr as your locales.
4. Add locales to the `next.config.ts` file:

```ts
export default withGTConfig(nextConfig, {
  defaultLocale: 'en-US',
  locales: ['en-US', 'fr', 'es', 'zh'],
});
```

5. Wrap strings with `t`:

```ts
const t = useGT();
t('Hello, world!');
```

6. (optional) Create a `.local.env` file and populate it with `GT_PROJECT_ID` and `GT_API_KEY`
   - These environment variables are needed for local translations during development. The `GT_API_KEY` should be a **development** API key. A separate **production API Key** is needed for subsequent steps when deploying to production.
7. `npm run dev`

To deploy this app to production:

1. Add `GT_PROJECT_ID` and `GT_API_KEY` to your `.env.local` file
   - The `GT_API_KEY` should be a **production** API key.
2. Add `npx gtx-cli translate` to your build step before the build command.
3. Deploy to Vercel / Render / etc..
