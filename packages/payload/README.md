# gt-payload

Payload CMS plugin for General Translation. It adds a Translate button to the admin
document view; clicking it reads the default-locale document, translates the configured
fields through the GT batch translate API, and writes every other configured locale via
Payload's Local API.

Lexical rich text is translated as a tree mapped onto GT's JSX model: only text-node
strings change, and the surrounding JSON structure is preserved exactly.

## Usage

```ts
import { gtPayload } from 'gt-payload';

export default buildConfig({
  localization: {
    locales: ['en', 'es', 'ja'],
    defaultLocale: 'en',
  },
  plugins: [
    gtPayload({
      collections: {
        posts: ['title', 'content'],
        pages: ['title', 'summary'],
      },
    }),
  ],
});
```

Auth comes from `GT_API_KEY` and `GT_PROJECT_ID` in the server environment. Configured
fields must be top-level and set `localized: true`; the plugin refuses to start
otherwise. Supported field types: text, textarea, richText (Lexical). The translate
endpoint requires a logged-in user and its Local API writes bypass collection access
control; translation runs cost API usage per click.
