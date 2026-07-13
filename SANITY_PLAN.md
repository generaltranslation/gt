# gt-sanity Field-Level Localization Plan

## Goal

Add field-level localization to `gt-sanity` with a first-party DX that mirrors the familiar `sanity-plugin-internationalized-array` model, while telling users to use `gt-sanity` instead of installing a second plugin.

The key outcome is:

- Users configure locales once in `gtPlugin()`.
- Users define localized fields with schema types like `internationalizedArrayString`.
- `gt-sanity` owns the schema types, Studio input components, translation export/import, and translation status tracking.
- Stored content uses the same array shape as the established Sanity internationalized-array pattern.
- Field-level translations use the same GT file/job workflow as document-level translations; only Sanity serialization/deserialization and patching differ.

## Verified Current Architecture (read before implementing)

The live translation flow does **not** go through the `Adapter` `exportForTranslation` / `importTranslation` abstraction. Those methods on `baseDocumentLevelConfig` and `baseFieldLevelConfig` are legacy from `sanity-translations-tab` and are currently unused (only referenced by their own tests). Concretely:

- **Live export:** `components/TranslationsProvider.tsx` (~line 302) calls `utils/serialize.ts → serializeDocument(cleanDoc, schema, baseLanguage)`, then `uploadFiles → initProject → createJobs`.
- **Live import:** `components/TranslationsProvider.tsx` (~line 722) calls `translation/importDocument.ts → documentLevelPatch`.
- `utils/serialize.ts:serializeDocument` **hardcodes** `translationLevel: 'document'` when calling `BaseDocumentSerializer(schema).serializeDocument(...)`.
- `baseFieldLevelConfig` is both unwired **and** internally inconsistent: its `exportForTranslation` serializes at document level while its `importTranslation` uses the object-keyed `fieldLevelPatch`. Do not frame Phase 1 as "fixing" it — retarget the live call sites instead.
- **GT files are HTML.** `serializeDocument` emits an HTML document with `<meta>` tags and `version='3'`, uploaded with `fileFormat: 'HTML'` (`adapter/createTask.ts`). Serialization/merge below must round-trip through this format, not through GROQ-style path strings.
- **A different field-level model already exists.** `serialize/index.ts` already branches on `translationLevel === 'field'`, using `languageObjectFieldFilter` to produce an **object-keyed** shape (`title: { en, es_ES }`), and `BaseDocumentMerger.fieldLevelMerge` writes flat patch keys like `title.es_ES`. The internationalized-array model in this plan is a **third, distinct** shape. Do not overload the `'field'` level value for it.

## User-Facing DX

Users should be able to configure field-level localization directly in `gtPlugin()`:

```ts
import { defineConfig, defineType, defineField } from 'sanity';
import { gtPlugin } from 'gt-sanity';

export default defineConfig({
  plugins: [
    gtPlugin({
      sourceLocale: 'en',
      locales: ['es', 'fr'],
      translateDocuments: ['post'],
      internationalizedArray: {
        enabled: true,
        fieldTypes: ['string', 'text'],
      },
    }),
  ],
  schema: {
    types: [
      // The generated `internationalizedArray*` types are registered by the
      // plugin. Users reference them by name from inside a document type's
      // `fields` array — NOT by putting `defineField` into `schema.types`,
      // which only accepts `defineType` document/object types.
      defineType({
        name: 'post',
        type: 'document',
        fields: [
          defineField({
            name: 'title',
            title: 'Title',
            type: 'internationalizedArrayString',
          }),
          defineField({
            name: 'description',
            title: 'Description',
            type: 'internationalizedArrayText',
          }),
        ],
      }),
    ],
  },
});
```

The stored shape must match `sanity-plugin-internationalized-array` exactly: each item has a **random `_key`**, the locale in a dedicated **`language`** field, and the data in **`value`**. The `_type` is the per-type value object (e.g. `internationalizedArrayStringValue`). This gives shape parity and zero-migration interop with existing internationalized-array data.

```json
{
  "title": [
    {
      "_key": "abc123",
      "_type": "internationalizedArrayStringValue",
      "language": "en",
      "value": "Hello"
    },
    {
      "_key": "def456",
      "_type": "internationalizedArrayStringValue",
      "language": "es",
      "value": "Hola"
    }
  ]
}
```

Querying is by the `language` field (matching the reference plugin):

```groq
*[_type == "post"] {
  "title": coalesce(title[language == $locale][0].value, title[language == $sourceLocale][0].value)
}
```

Implication for import/merge: because `_key` is random, you **cannot** address an item by locale (`title[_key=="es"]`). Sanity mutations only target array items by `_key`, so import must first read the array, find the item where `language == targetLocale`, and patch _that_ item's `_key` (or insert a new item with a fresh random `_key`). See Import and Merge.

## Public API

Add an `internationalizedArray` option to `GTPluginConfig`, with `fieldLevelLocalization` as a more descriptive alias. This should intentionally mirror the useful parts of `sanity-plugin-internationalized-array` while keeping `sourceLocale` and `locales` as the only source of locale identity.

Keep the v1 config surface small. Several options from `sanity-plugin-internationalized-array` (`buttonLocations`, `buttonAddAll`, `languageDisplay`, `select`) only matter once there's a custom input with those affordances; defer them until the input grows beyond `renderDefault()`. Match the reference plugin's stored item fields: locale in `language`, data in `value` — keep both names fixed (non-configurable) in v1 so serializer/detector/merger don't have to read config. (Note there is also an unrelated top-level `GTPluginConfig.languageField`, default `'language'`, which drives `@sanity/document-internationalization` for _document-level_ translation — different concept, stays. The array item's `language` field happens to share the default name, which is convenient but they are distinct.)

```ts
type GTFieldLevelLocalizationConfig = {
  enabled?: boolean;
  fieldTypes?: FieldLevelFieldType[];
  languageTitles?: Record<string, string>;
  getLanguageTitle?: (locale: string) => string;
  typePrefix?: string;
  includeCompatibilityTypes?: boolean;

  // Deferred past v1 (need a custom input first):
  // buttonLocations?: Array<'field' | 'document' | 'unstable__fieldAction'>;
  // buttonAddAll?: boolean;
  // languageDisplay?: 'title' | 'id';
  // select?: 'all' | string[];
  //
  // No item-field config: locale stored in `language`, data in `value`
  // (random `_key`), matching the reference plugin.
};

type FieldLevelFieldType =
  | 'string'
  | 'text'
  | 'array'
  | 'block'
  | {
      name: string;
      type: string;
      title?: string;
      of?: unknown[];
      fields?: unknown[];
      options?: Record<string, unknown>;
    };
```

Defaults:

- `enabled`: `false`
- `fieldTypes`: `['string', 'text']`
- Language titles are derived from locale properties.
- `typePrefix`: `'internationalizedArray'`
- `includeCompatibilityTypes`: `true`
- Item shape matches the reference plugin: random `_key`, locale in `language`, data in `value` (field names fixed, not configurable in v1).

Do not require users to duplicate locale config:

- `sourceLocale` and `locales` remain the source of truth.
- `internationalizedArray.languageTitles` and `internationalizedArray.getLanguageTitle` are only display-label escape hatches.
- Users should not redefine the actual locale set inside `internationalizedArray`.

Generated type names should match the established DX:

- `internationalizedArrayString`
- `internationalizedArrayText`
- `internationalizedArrayBlock`
- `internationalizedArray<CustomName>`

If both compatibility and GT aliases are enabled, both type names should point to the same generated field implementation.

## Do Not Require sanity-plugin-internationalized-array

`gt-sanity` should not require users to install `sanity-plugin-internationalized-array`.

Instead:

- Reuse the same data shape.
- Reuse the same general schema naming convention.
- Reuse the same plugin option names where they make sense inside `gtPlugin()`.
- Document that users should choose `gt-sanity` for GT-managed translation workflows.
- Warn that users should not install both plugins with overlapping generated type names, because both would define `internationalizedArray*` schema types.

## Schema Generation

Add schema generation inside `gtPlugin()` when `internationalizedArray.enabled` or `fieldLevelLocalization.enabled` is true.

The plugin return value should include generated schema types:

```ts
return {
  name: 'gt-sanity',
  plugins,
  schema: {
    types: createInternationalizedArrayTypes({
      sourceLocale: resolvedSourceLocale,
      locales,
      fieldTypes,
      languageTitles,
      getLanguageTitle,
      typePrefix,
      includeCompatibilityTypes,
      // Item fields fixed: `language` (locale) + `value` (data); `_key` random.
    }),
  },
  tools: [...],
  document: {...},
};
```

Each generated type should be an array of objects:

```ts
{
  name: 'internationalizedArrayString',
  type: 'array',
  of: [
    {
      type: 'object',
      name: 'internationalizedArrayStringValue',
      // `language` is set by the input (read-only to the editor); `_key` is random.
      fields: [
        { name: 'language', type: 'string', readOnly: true },
        { name: 'value', type: 'string' },
      ],
    },
  ],
}
```

For `text`, `value` should be `type: 'text'`.

For Portable Text, generate an array value field:

```ts
{
  name: 'value',
  type: 'array',
  of: [{type: 'block'}]
}
```

For custom field types, preserve the user-provided field definition under the `value` field.

## Studio Input UX

Add a custom input component for generated internationalized array fields.

Initial UX:

- Show one editable section per configured locale.
- Show the source locale first.
- Auto-create the source-locale entry from `sourceLocale`.
- Create items with a random `_key` and set `language` to the locale id; never reuse `_key` as the locale.
- Render the field value using Sanity's default input via `renderDefault()` where possible.

Later UX improvements:

- Locale tabs or segmented control.
- Translation status badges.
- "Copy from source" action for a target locale.
- "Translate this field" action for single-field translation.

Implementation note: do not build the first version as a hidden/opaque input. Editors should be able to inspect and manually edit each locale value.

Compatibility target:

- Match the internationalized-array plugin's editor mental model closely enough that existing Sanity users recognize it.
- Support the same generated type-name convention.
- Support the same stored array item shape.
- Do not promise internal implementation compatibility.

## Translation Strategy

Add an explicit translation strategy layer instead of branching throughout React components, and wire it into the **live** call sites (`TranslationsProvider.tsx` export, `importDocument.ts` import) — not the unused `Adapter` configs.

Use a distinct level value for the internationalized-array model. The existing `TranslationLevel = 'document' | 'field'` already assigns `'field'` to the legacy object-keyed model (`title.es_ES`), so introduce a third value rather than overloading it:

```ts
type TranslationLevel = 'document' | 'field' | 'internationalizedArray';

type TranslationStrategy = {
  level: TranslationLevel;
  // serialize a Sanity doc into the GT HTML file
  serialize: (
    document: SanityDocument,
    schema: Schema,
    baseLanguage: string
  ) => GTFile;
  // deserialize the translated GT HTML file and patch Sanity in place
  patch: (
    docInfo: GTFile,
    deserialized: SanityDocument,
    localeId: string,
    client: SanityClient
  ) => Promise<void>;
};

function getTranslationStrategy(document: SanityDocument): TranslationStrategy;
```

Suggested config:

```ts
translationLevel?: 'document' | 'internationalizedArray' | 'mixed';
fieldLevelDocuments?: TranslateDocumentFilter[] | string[];
```

Behavior:

- `document`: current document-level behavior (live default; unchanged).
- `internationalizedArray`: use the array serialize/patch for all matched documents.
- `mixed`: use `fieldLevelDocuments` for the array path and document-level for everything else.

When schema generation is enabled, default `translationLevel` stays `document` for backward compatibility. Schema generation (`internationalizedArray.enabled`) and translation routing (`translationLevel`) are independent — enabling schema types alone gives editable fields but no field-level translation until the user opts in. To avoid an "enabled but nothing translates" surprise, the translate action / status table must detect `internationalizedArray*` fields from the **schema**, not from `translationLevel`.

Both document-level and array strategies reuse the same GT upload/enqueue/status/download/import workflow. The only difference is the serialize/patch pair selected per document.

## Serialization

Current state:

- `utils/serialize.ts:serializeDocument` hardcodes `'document'` when calling `BaseDocumentSerializer(schema).serializeDocument(...)`.
- The underlying `BaseDocumentSerializer` already accepts a `translationLevel`, and already handles `'field'` as the **legacy object-keyed** model. The array model is new work, not a flag flip.

Refactor `serializeDocument` to thread a level through:

```ts
export function serializeDocument(
  document: SanityDocument,
  schema: Schema,
  baseLanguage: string,
  level: TranslationLevel = 'document'
);
```

Then update the **live** export site in `TranslationsProvider.tsx` to pass the level chosen by `getTranslationStrategy`. Document-level passes `'document'`; the array strategy passes `'internationalizedArray'`.

GT files are HTML (`fileFormat: 'HTML'`, `<meta>` tags, `version='3'`). The array serializer must integrate with that format, so:

1. **Detect `internationalizedArray*` fields before generic array serialization.** `serializeArray` would otherwise treat each `{_key, language, value}` entry as an ordinary array element and serialize every locale. Detection (by schema type name / shape) must short-circuit the generic array path.
2. Export only the source-locale item's `value` (`field[language == sourceLocale][0].value`), recursing into Portable Text / object values via the existing serializers.
3. Emit HTML that carries the field name and the fact that it's an array field, so the deserializer/merge can resolve the target item by `language` and patch its `value` on the way back (see Import and Merge). Do not invent a GROQ-string metadata channel; reuse the existing div/class + `<meta>` mechanism and bump/extend the version marker if the shape changes.

If a document has no source-locale item for a field, skip that field (nothing to translate) rather than erroring.

## Shared GT File Workflow

Field-level localization should reuse the existing document-level GT API flow:

1. Serialize the Sanity document into a GT source file.
2. Upload the source file.
3. Enqueue translation jobs.
4. Check/poll translation status.
5. Download translated files.
6. Deserialize and patch Sanity.

The shared workflow should not care whether a document is document-level or field-level. It should call the selected strategy adapter:

```ts
type SanityTranslationAdapter = {
  level: 'document' | 'internationalizedArray';
  serialize: (
    document: SanityDocument,
    schema: Schema,
    baseLanguage: string
  ) => GTFile;
  patch: (
    docInfo: GTFile,
    deserialized: SanityDocument,
    localeId: string,
    client: SanityClient
  ) => Promise<void>;
};
```

Document-level adapter:

- Serializes normal document fields.
- Imports by creating/updating translated Sanity documents.
- Uses document internationalization metadata.
- Supports reference patching.

Internationalized-array adapter:

- Serializes only source-locale `value` entries from `internationalizedArray*` fields.
- Imports by upserting target-locale `value` entries into the same Sanity document.
- Does not create translated Sanity documents.
- Does not need runtime GT translation APIs.

This keeps the GT API integration consistent. Field-level support becomes a Sanity serializer/deserializer concern, not a separate API mode.

## Import and Merge

Add a merge path for internationalized arrays.

Because `_key` is random, the merge **cannot** address items by locale — it must read the current array and resolve items by their `language` field. For each translated field:

1. Find the source-locale item (`language == sourceLocale`).
2. Deserialize the translated `value`.
3. Find the target-locale item (`language == targetLocale`) in the current array.
4. If it exists, patch _its_ `_key`'s `value`.
5. If missing, insert a new item with a fresh random `_key`:

```ts
{
  _key: randomKey(), // reuse src/utils/randomKey.ts
  _type: `${typeName}Value`, // e.g. internationalizedArrayStringValue
  language: targetLocale,
  value: translatedValue
}
```

This is **not** the flat-key `.set({'title.es_ES': value})` patch used by the legacy object-keyed merge — that's a different storage model and must not be reused. Use Sanity's array patch semantics, which only target items by `_key`:

```ts
const existing = (baseDoc[field] ?? []).find(
  (it) => it.language === targetLocale
);

const patch = client.patch(baseDoc._id).setIfMissing({ [field]: [] });
if (existing) {
  // patch the existing item by its actual (random) _key
  patch.set({ [`${field}[_key=="${existing._key}"].value`]: translatedValue });
} else {
  patch.insert('after', `${field}[-1]`, [
    {
      _key: randomKey(),
      _type: `${typeName}Value`,
      language: targetLocale,
      value: translatedValue,
    },
  ]);
}
await patch.commit();
```

Resolve update-vs-insert per field from the array contents; you cannot rely on a `[_key=="<locale>"]` selector because `_key` is random, and a `[language=="<locale>"]` selector is not valid in a mutation (only GROQ reads support attribute predicates).

## Locale IDs and Keys

Keep API locale ids unchanged:

- `fr-CA`
- `pt-BR`
- `zh-Hant`

For stored array item data:

- `language` holds the exact, unmodified locale id (`fr-CA`, `pt-BR`, `zh-Hant`).
- `_key` is a random opaque string (use `src/utils/randomKey.ts`), **not** derived from the locale — matching the reference plugin.

Do not add `localeToArrayKey` / `arrayKeyToLocale` helpers: `_key` is intentionally not the locale, so there is no locale↔key mapping to centralize. The `-` → `_` normalization in the existing object-keyed code is a constraint of JSON object keys / dotted patch paths in that older model and is irrelevant here. All locale matching happens against the `language` field, which preserves hyphens.

## Document Internationalization Interaction

Field-level localization and document-level internationalization solve different problems.

When a document type is configured for field-level localization:

- Do not auto-enable `@sanity/document-internationalization` for that document type. Concretely: `gtPlugin` currently passes every `translateDocuments` type into `documentInternationalization({ schemaTypes })` (`index.ts` ~lines 177–196). Array-localized types must be **filtered out** of that `schemaTypes` array, or they'll get language badges and per-locale document creation.
- Do not create per-locale translated documents.
- Do not show "Patch Document References" as an applicable action.

When a document type is configured for document-level localization:

- Keep current behavior.
- Continue using document-level metadata and reference patching.

For `mixed` mode, split document types before configuring document internationalization.

## Translation Metadata

Do not require a field-level metadata document for the first version.

Field-level imports should work in place:

- Source values live in `field[language == sourceLocale][0].value`.
- Target values live in `field[language == targetLocale][0].value`.
- In-progress and ready status should come from the same GT file/job workflow used by document-level translation.
- Imported/missing state can be derived from whether the target locale item exists and has a value.
- Batch UI counts can combine GT job status with the document content at render/fetch time.

Two consequences of going metadata-free, both acceptable for v1 but call them out:

- **Staleness regression.** Document-level tracks the source revision (`_rev` + `findDocumentAtRevision` + `translation.metadata`) and can flag "source changed since translated." In-place array fields have no such record, so the status UI cannot show stale state for field-level docs. This is a real capability gap vs document-level, not a wash.
- **`_rev` in the status cache key.** Translation status is cached under `createTranslationStatusKey(branchId, documentId, _rev, locale)` (`adapter/types.ts`, `TranslationsTable.tsx`). Document-level is safe because each locale is a separate document; array localization is in-place, so importing one locale bumps the single source doc's `_rev` and can invalidate the cached status of the other locales mid-batch (stale/flickering rows). Decide explicitly: drop `_rev` from the key (use published id) for array-localized docs, or recompute status from GT job state + array contents at render time.

Optional metadata can be reconsidered later only if there is a real product need for:

- Stale translation detection by source revision.
- Human review workflow state.
- Historical audit logs.
- Extra Studio-only state not already represented by GT file/job status or localized field values.

## UI Changes

Update the translations tool and translation action to understand strategy.

Field-level docs:

- Translate/import buttons should operate on the same document.
- In-progress and ready status should come from GT file/job status.
- Existing imported/missing status should be derived from in-place localized array values.
- Hide or disable "Patch Document References".
- Publish behavior should publish the source document/draft containing all localized fields.

Document-level docs:

- Keep current behavior.

Mixed mode:

- Either separate field-level and document-level documents in the table, or show a "Mode" column.

## Backward Compatibility

Keep existing public behavior unchanged unless users opt in.

Existing document-level users should not see:

- New schema types unless `internationalizedArray.enabled` or `fieldLevelLocalization.enabled` is true.
- Changed import behavior.
- Changed document internationalization behavior.

Existing internal object-keyed field-level tests can remain, but the new public field-level API should prioritize internationalized arrays.

## Testing Plan

Add tests for schema generation:

- Generates `internationalizedArrayString`.
- Generates `internationalizedArrayText`.
- Generates aliases if enabled.
- Supports custom field types.
- Does not generate schema types when disabled.

Add serialization tests:

- Exports only the source locale item.
- Handles string, text, Portable Text, and custom object values.
- Ignores non-localized arrays.
- Handles nested internationalized array fields.

Add merge/import tests:

- Updates an existing target locale item.
- Inserts a missing target locale item.
- Preserves source locale item.
- Preserves non-translatable sibling data.
- Handles hyphenated locale ids.
- Handles source locale ids with hyphens.

Add strategy tests:

- `document` mode uses current document-level path.
- `internationalizedArray` mode uses the array serialize/patch path.
- `mixed` mode routes by document type and document id.

Add UI-adjacent tests where feasible:

- Field-level docs do not show reference patching.
- Field-level docs use GT file/job status for in-progress and ready states.
- Field-level docs derive imported/missing status from localized array values.

## Implementation Phases

### Phase 1: Strategy and Serialization Foundation

- Extend `TranslationLevel` with `'internationalizedArray'` (keep `'document'` and the legacy `'field'`).
- Refactor `utils/serialize.ts:serializeDocument()` to accept and thread `level` (currently hardcodes `'document'`).
- Add a strategy resolver and `SanityTranslationAdapter` (`serialize` / `patch`).
- Route the **live** call sites through the strategy: the export in `TranslationsProvider.tsx` (~line 302) and the import in `importDocument.ts` / `TranslationsProvider.tsx` (~line 722). Do **not** touch the unused `baseFieldLevelConfig` / `baseDocumentLevelConfig` adapter methods — either delete `baseFieldLevelConfig` or leave it untouched as dead code; it is not on the live path.

### Phase 2: Internationalized Array Schema Types

- Add `internationalizedArray` plugin config with `fieldLevelLocalization` as an alias.
- Generate `internationalizedArray*` schema types.
- Add basic input component.
- Add tests for generated schemas.

### Phase 3: Internationalized Array Export/Import

- Add detection for internationalized array fields.
- Export source locale `value`.
- Import by upserting target locale `value`.
- Add merge tests for existing and missing target locale entries.

### Phase 4: Workflow Status and UI

- Reuse GT file/job status for field-level in-progress and ready states.
- Derive imported/missing status from localized array values.
- Update translation table/status/import missing logic.
- Hide incompatible document-level actions for field-level docs.
- Defer extra stale-status metadata unless a product need appears.

### Phase 5: Docs and Migration

- Update `packages/sanity/README.md`.
- Add examples for string, text, Portable Text, and custom fields.
- Add GROQ examples.
- Add "Do not install both plugins" guidance.
- Add migration notes from `sanity-plugin-internationalized-array`.

## Open Questions

Resolved by this revision (kept here for traceability):

- ~~Should `enabled` imply `translationLevel`?~~ No — schema generation and translation routing stay independent (see Translation Strategy). Detect array fields from the schema so "enabled but nothing translates" can't happen silently.
- ~~Should `_key` be the locale or normalized?~~ Neither — `_key` is random and the locale lives in the `language` field, matching the reference plugin. Locale matching is by `language`; patches resolve to the item's actual `_key` first (see Import and Merge).

Still open:

- How much of the custom input UX should ship in the first version versus relying on Sanity's default array/object inputs?
- Should the array path support single-field translation actions in the first release, or only document-wide batch translation of localized fields?
- Should array-localized docs support the same import-missing semantics as document-level docs, or should import be explicit per ready GT file?
- Should the status cache key drop `_rev` for array-localized docs, or should status be recomputed from GT job state + array contents at render time?

## Recommended Defaults

- `internationalizedArray.enabled` only controls generated schema types and input components.
- `fieldLevelLocalization` remains a supported alias for clarity and backwards compatibility if introduced earlier.
- `translationLevel` remains explicit and defaults to `'document'`.
- Field-level docs use the same GT file/job workflow as document-level docs.
- Compatibility names like `internationalizedArrayString` are enabled by default.
- GT-prefixed aliases are also available to avoid migration dead ends.
- Locale is stored in the `language` field (exact id); `_key` is random and never used to identify the locale.
- First release supports document-wide translation of field-level localized fields; single-field actions can follow later.
- Do not create a field-level metadata document in the first release.
