<p align="center">
  <a href="https://generaltranslation.com/docs/sanity">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/sanity"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-sanity

General Translation plugin for Sanity Studio v3.

## Installation

```bash
npm install gt-sanity
```

## Quick Start

```ts
import { defineConfig } from 'sanity';
import { gtPlugin } from 'gt-sanity';

export default defineConfig({
  plugins: [
    gtPlugin({
      sourceLocale: 'en',
      locales: ['es', 'fr'],
      // Initialize translated document slugs with a unique locale suffix,
      // e.g. "hello-world" -> "hello-world-es".
      dedupeFields: [{ fields: [{ property: '$.slug' }] }],
    }),
  ],
});
```

See the [full documentation](https://generaltranslation.com/docs/sanity) for guides and API reference.

## Field-Level Localization

Field-level localization is powered by
[`sanity-plugin-internationalized-array`](https://github.com/sanity-io/sanity-plugin-internationalized-array) —
the reference Sanity plugin. `gtPlugin` configures it for you from your
locales; gt-sanity does not ship its own field-level UI, so Studio behavior
always matches the native plugin.

```ts
gtPlugin({
  sourceLocale: 'en',
  locales: ['es', 'fr'],
  translateDocuments: ['post'],
  // Documents matched above are localized in place with
  // internationalized arrays instead of per-locale documents.
  translationLevel: 'internationalizedArray',
  fieldLevelLocalization: {
    enabled: true,
    fieldTypes: ['string', 'text'],
  },
});
```

Then use the generated types in your schemas
(`type: 'internationalizedArrayString'`, etc.).

### Bringing your own plugin instance

Already registering `sanity-plugin-internationalized-array` yourself? Keep
your setup — GT translation only reads and writes the stored
`{ _key, _type, language, value }` data, regardless of who registered the
schema types. Leave `fieldLevelLocalization` disabled so the types are only
registered once, and just opt the documents into field-level translation:

```ts
plugins: [
  internationalizedArray({
    languages: [
      { id: 'en', title: 'English' },
      { id: 'es', title: 'Spanish' },
    ],
    fieldTypes: ['string'],
  }),
  gtPlugin({
    sourceLocale: 'en',
    locales: ['es'],
    translateDocuments: ['post'],
    translationLevel: 'internationalizedArray',
    // No fieldLevelLocalization — your plugin instance owns the types.
  }),
],
```

To verify: open a document of a matched type, run Translate from the
document actions menu (or the Translations tool), and confirm each localized
field gains items for the target locales while the Studio UI (per-language
add buttons, language labels) stays exactly as your plugin configures it.

## Excluding Fields from Translation

Mark fields in your schema instead of maintaining a list in the plugin
config. gt-sanity honors its own `options.gt.exclude` plus the exclusion
options of the standard Sanity localization plugins:

```ts
defineField({
  name: 'internalNotes',
  type: 'string',
  options: {
    gt: { exclude: true }, // excluded from GT translation
    // Also honored:
    // documentInternationalization: { exclude: true }, // @sanity/document-internationalization
    // aiAssist: { exclude: true }, // @sanity/assist
  },
});
```

Exclusion applies at any depth, including fields of nested object types, and
can also be set on a custom type definition's `options` to exclude every
occurrence of that type (matching the native plugins' "field or type"
semantics). The legacy `localize: false` field property is still supported. For id-based or
cross-document rules (e.g. slug deduplication), the plugin-level
`ignoreFields` / `skipFields` / `dedupeFields` options remain available.

## Preserving Edits to Translations

Translated content often gets touched up in the Studio after it comes back from
General Translation, and a later translation run would normally regenerate it.
The **Save local edits** toggle in the Translations tool changes that:
with it on, the translations currently in Sanity are uploaded to General
Translation before a translation run, so content whose source text has not
changed is reused from the Sanity version instead of being regenerated.

This is **off by default**; turning it on shows an explanation of the trade-off
first, and the choice lasts for the Studio session. Turning it on means local
content overwrites whatever General Translation holds for that source version —
including a completed translation that has not been imported into Sanity yet.
Import pending translations before enabling it if that matters to you.

Set the initial state of the toggle from plugin config:

```ts
gtPlugin({
  // ...
  preserveExistingTranslations: true,
});
```

To upload the translations already in Sanity without starting a translation run
— useful when adopting the plugin on a project that was translated elsewhere —
use **Save Local Edits**. It uploads the source files it needs, but does not
enqueue any translation.

To regenerate translations and deliberately discard existing ones for a single
run, use **Retranslate from scratch** in the Translate All dialog.
