---
'gt-payload': minor
---

Support Payload 4 and drop Payload 3. On Payload 3, stay on `gt-payload@^0.1`.

- Requires `payload`, `@payloadcms/next` and `@payloadcms/ui` 4, and Next.js 16.4 or later.
- Translating without a signed-in user, as from server code or Payload's job queue, still skips access rules now that Payload's Local API applies them by default.
- The Translate button on globals moves to `admin.components.edit.beforeDocumentControls`, where Payload 4 renders it.
- Blocks referenced by slug, in blocks fields and in Lexical rich text, are translated.
- Payload's `slug` field type is left to Payload and the editor, as the slug field was before.
- The admin panel uses Payload 4's design tokens, and the Translations page has its own title and breadcrumb.
- The Translate button appears only on documents with text to translate and only for users who may save them. A refused request says the user lacks permission instead of asking them to try again.
- A site-wide run by a signed-in user covers only the documents they may edit, instead of reporting the rest as failed. This also applies to `translateSite` and `saveSiteTranslations` with a `user`.
- A run that asks for a locale General Translation cannot translate into, or one outside the Payload config, is refused with a 400 naming it, instead of quietly translating less than asked.
