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
first, and the choice is remembered for that project and dataset. Turning it on means local
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

## Automatic Actions

The Translate dialog on a document can refresh status, import a translation as
soon as it lands, repoint references, and publish the result. Each is a switch
in that dialog, and each has a plugin-level default:

```ts
gtPlugin({
  // ...
  autoRefresh: true, // poll for completed translations
  autoImport: true, // import a translation as soon as it completes
  autoPatchReferences: false, // repoint references after import
  autoPublish: false, // publish translated documents after import
});
```

The defaults turn on what only reads or writes drafts, and leave off anything
that can reach readers:

- `autoRefresh` only polls for status, and auto-import depends on it.
- `autoImport` writes drafts, which are cheap to discard.
- `autoPatchReferences` usually writes a draft too, but when a translated
  document is already published and has no draft, the reference rewrite is
  applied to a draft seeded from it rather than to the published document.
  Still opt-in, because it edits documents you may consider finished.
- `autoPublish` publishes, and turning the switch back off unpublishes nothing.

These are starting points, not locks. Whatever the user sets in the Studio is
remembered in `localStorage` for that project and dataset, and is preferred
over the config on their next visit. The **Save local edits** toggle
(`preserveExistingTranslations`) is remembered the same way; enabling it still
shows its explanation first.

Translated documents are always created as **drafts**. With `autoPublish` off
they stay that way until someone publishes them — so if a translation seems
missing after a run, check the Drafts perspective before assuming it wasn't
created.

## Browsing Translations by Locale

By default a translated document sits in the same list as its source, so a
type's list grows by one entry per locale. `gtStructureItems` groups them
instead: each translatable type expands into a pane per locale.

```ts
import { structureTool } from 'sanity/structure';
import { gtStructureItems } from 'gt-sanity';

structureTool({
  structure: (S, context) =>
    S.list()
      .title('Content')
      .items([
        ...gtStructureItems(S, context),
        S.divider(),
        ...S.documentTypeListItems(),
      ]),
});
```

This is opt-in: the structure tool's layout belongs to `structureTool()` in
your Studio config, so a plugin cannot set it for you. Use `gtStructure()` for
the whole structure when you have no other list items:

```ts
import { gtStructure } from 'gt-sanity';

structureTool({ structure: gtStructure() });
```

The source pane includes documents whose language field is unset, since content
that predates the plugin has no language. Types localized in place with
internationalized arrays are skipped — their translations live inside the source
document, so there is nothing to group. Pass `types` to override which types are
grouped, and `sourceTitle` / `localeTitle` to change the pane titles.

## Debug Info

The Translations tool footer shows the installed plugin version and a **Debug
info** button. It opens the plugin's effective configuration — resolved source
and target locales, `translationLevel`, which documents are matched, field
rules, the active preferences, and whether the secrets document was found — with
a button to copy it for a support request.

The API key is never included, only whether one is set.
