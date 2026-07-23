# gt-next + Sanity example

A minimal Next.js App Router application with `gt-next` and an embedded Sanity Studio.

The Sanity schemas intentionally do not configure `gt-sanity` yet. Comments in
`src/sanity/schemaTypes` mark the document-level, internationalized-array, and
mixed-mode translation setup that can be added later.

## Run locally

```bash
cp .env.example .env.local
# Add a Sanity project ID to .env.local.
pnpm dev
```

Open the website at [http://localhost:3000](http://localhost:3000) and the
embedded Studio at [http://localhost:3000/studio](http://localhost:3000/studio).
Without a project ID, `/studio` shows setup instructions instead of starting the
Studio.

## Translation fixtures

- `documentTranslationExample` covers document-level strings, text, Portable
  Text, string arrays, nested objects, and arrays of objects.
- `fieldTranslationExample` marks fields for the generated
  `internationalizedArrayString`, `internationalizedArrayText`,
  `internationalizedArrayBlock`, and custom object types.
- Using both document types later covers `translationLevel: 'mixed'`.
- Slugs, references, images, dates, booleans, numbers, and URLs are included as
  deliberate non-translatable fields.
