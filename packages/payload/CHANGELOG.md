# gt-payload

## 0.2.0-samsara.4

### Patch Changes

- Updated dependencies [cf23e00]
  - generaltranslation@10.0.0-samsara.3

## 0.2.0-samsara.3

### Patch Changes

- generaltranslation@10.0.0-samsara.2

## 0.2.0-samsara.2

### Patch Changes

- Updated dependencies [22b6915]
- Updated dependencies [f3ed76d]
- Updated dependencies [4b6ea22]
- Updated dependencies [cc73381]
- Updated dependencies [726168a]
- Updated dependencies [040ea63]
  - generaltranslation@10.0.0-samsara.1

## 0.2.0-samsara.1

### Minor Changes

- dc7e89b: Support Payload 4 and drop Payload 3. On Payload 3, stay on `gt-payload@^0.1`.
  - Requires `payload`, `@payloadcms/next` and `@payloadcms/ui` 4, and Next.js 16.4 or later.
  - Translating without a signed-in user, as from server code or Payload's job queue, still skips access rules now that Payload's Local API applies them by default.
  - The Translate button on globals moves to `admin.components.edit.beforeDocumentControls`, where Payload 4 renders it.
  - Blocks referenced by slug, in blocks fields and in Lexical rich text, are translated.
  - Payload's `slug` field type is left to Payload and the editor, as the slug field was before.
  - The admin panel uses Payload 4's design tokens, and the Translations page has its own title and breadcrumb.
  - The Translate button appears only on documents with text to translate and only for users who may save them. A refused request says the user lacks permission instead of asking them to try again.
  - A site-wide run by a signed-in user covers only the documents they may edit, instead of reporting the rest as failed. This also applies to `translateSite` and `saveSiteTranslations` with a `user`.
  - A run that asks for a locale General Translation cannot translate into, or one outside the Payload config, is refused with a 400 naming it, instead of quietly translating less than asked.

## 0.1.5

### Patch Changes

- Updated dependencies [[`b3c3647`](https://github.com/generaltranslation/gt/commit/b3c3647239a6c44c3549e722b7001b83624865f8)]:
  - generaltranslation@9.5.11

## 0.1.4

### Patch Changes

- Updated dependencies [[`e1c64a3`](https://github.com/generaltranslation/gt/commit/e1c64a3c27c7a05ffeb81eb2d04ace795d0c3ab5)]:
  - generaltranslation@9.5.10

## 0.1.3-samsara.0

### Patch Changes

- bb107a8: Fix published type declarations that failed to resolve, or resolved to CommonJS types, under `moduleResolution` `node16` or `nodenext`.
- Updated dependencies [da7af80]
- Updated dependencies [bb107a8]
- Updated dependencies [002f579]
  - generaltranslation@10.0.0-samsara.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`c460193`](https://github.com/generaltranslation/gt/commit/c46019337dda8440a7174d783ad94a0f9b15f79a)]:
  - generaltranslation@9.5.9

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.5.8

## 0.1.2-samsara.0

### Patch Changes

- generaltranslation@9.5.8-samsara.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`c220f39`](https://github.com/generaltranslation/gt/commit/c220f39182a61be3d8139bfe18c5bced0f2956dc)]:
  - generaltranslation@9.5.7

## 0.1.0

### Minor Changes

- [#2429](https://github.com/generaltranslation/gt/pull/2429) [`2b4862d`](https://github.com/generaltranslation/gt/commit/2b4862d30c0a7ddcade5fd7b457f732e73b8c590) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `gt-payload`, a plugin that translates a Payload CMS site's localized fields from a button on each document or for the whole site, and saves edits made in Payload back to General Translation.
