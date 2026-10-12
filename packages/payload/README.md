<p align="center">
  <a href="https://generaltranslation.com/docs">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-payload

General Translation plugin for [Payload CMS](https://payloadcms.com) 3.

It translates your localized fields into each locale in your Payload config,
from a button on every document or for the whole site at once.

## Installation

```bash
npm install gt-payload
```

## Setup

Your Payload config needs [localization](https://payloadcms.com/docs/configuration/localization)
with the fields you want translated marked `localized: true`. Then add the
plugin:

```ts
import { buildConfig } from 'payload';
import { gtPlugin } from 'gt-payload';

export default buildConfig({
  // ...
  localization: { locales: ['en', 'es', 'fr'], defaultLocale: 'en' },
  plugins: [gtPlugin()],
});
```

Set your project ID and an API key from the
[General Translation dashboard](https://generaltranslation.com/dashboard):

```bash
GT_PROJECT_ID=...
GT_API_KEY=...
```

Regenerate Payload's import map so the admin panel loads the plugin's
components. The plugin adds a collection that tracks translation runs, so on
Postgres or SQLite create a migration as for any schema change:

```bash
npx payload generate:importmap
npx payload migrate:create
```

Locale codes GT does not recognise can be mapped, as in `gt.config.json`:

```ts
gtPlugin({ customMapping: { cn: { code: 'zh' } } });
```

## Usage

- **Translate:** on any document or global with localized fields, choose
  Translate, pick the languages and translate.
- **Save local edits:** sends what your locales hold now to General
  Translation, so edits made in Payload, and translations made before you
  installed the plugin, are kept on later runs. Turn on **Save local edits
  before translating** to do this before each translation.
- **Whole site:** the **Translations** page in the admin nav does the same
  for every document and global at once, and shows which languages each
  document has text in.

Translations are saved as drafts on collections and globals with drafts
enabled, and directly otherwise. The plugin never publishes.

Translations keep going after the tab that started them closes. They finish
the next time anyone opens the admin panel, or right away when Payload's
[jobs queue](https://payloadcms.com/docs/jobs-queue/overview) runs, for
example with `jobs.autoRun` or a cron calling `/api/payload-jobs/run`.

## What gets translated

Text, textarea and rich text fields that are localized, including those
inside groups, tabs, arrays and blocks. Plain text values that are paths,
URLs or emails, Payload's slug field, and read-only or hidden fields are left
as they are. Required fields that are not translated take the default
locale's value, so the locale can be saved.

A translation longer than a field's `maxLength`, or than the SEO plugin's
recommended length for meta titles and descriptions, is translated again to
fit. If it still does not fit a `maxLength`, it is cut at a word and ends with
an ellipsis. SEO lengths are recommendations, so those are never cut.

To leave a field out, mark it:

```ts
{ name: 'sku', type: 'text', localized: true, custom: { gt: { translate: false } } }
```
