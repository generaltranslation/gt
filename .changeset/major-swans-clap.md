---
'gt-sanity': major
---

Add Sanity 6 support and drop the Sanity 5 generation.

`gt-sanity` now targets `sanity` 6.9.2+ and `@sanity/ui` 4. Sanity moved from `@sanity/ui` 3 to 4 in 6.9.2, so Studios on 6.0 through 6.8 are still on the `@sanity/ui` 3 generation and should stay on `gt-sanity` 3.1.x.

**Breaking changes**

- **ESM-only.** The CommonJS build and the `require` export condition are removed, following `@sanity/ui` 4.
- **Node.js 22.12+ required**, up from 18, matching `sanity` and `@sanity/ui` 4.
- **Peer dependencies replace bundled Studio packages.** `@sanity/ui`, `@sanity/icons`, `@sanity/schema` and `@sanity/mutator` were previously regular dependencies. Because they are Studio runtime singletons, installing alongside a different Sanity generation nested a second copy, producing duplicate schema registries and duplicate styled-components theme contexts. They are now peer dependencies resolved from the host Studio.

**Dependency fixes**

- The `sanity` peer range was `>=5.0.0`, which admitted Sanity 6 even though the dependencies pinned the Sanity 5 generation. Installs resolved cleanly instead of warning, so the duplicate runtime was silent. The range is now `^6.9.2`.
- Raised the `@sanity/document-internationalization` and `sanity-plugin-internationalized-array` floors to `^6.2.30` and `^5.1.27`. The previous floors could resolve to releases that only support `sanity` 5, a second path to a duplicated runtime.
- Removed the unused `@sanity/util` dependency.

**Fixes**

- `gtStructureItems` now pins an `apiVersion` on the document lists it builds. Those lists supply a custom filter, and Sanity warns once per list when the version is omitted, which it has said will become an error. The version is shared with the plugin's Sanity client as `SANITY_API_VERSION`.
- **Publish Translations silently skipped documents whose source locale had been relabelled.** Publish found the source entry in `translation.metadata` by matching `language` against the configured source locale. A metadata document written before that label changed — `en` to `en-US`, say — still carries the old code, so the subquery matched nothing and the whole group was dropped before publishing started, with no error. Importing was unaffected because it resolves documents by a different key, so publishing appeared to do nothing with no indication why. The inverse test had the same cause and a worse outcome: `language != $sourceLocale` treated a relabelled source entry as a translation and queued the source document itself for publishing. Source and translation entries are now told apart by which document they reference rather than by their language label.

**Translation progress in the Translations tool**

- **Translate All** stayed idle while a run was still in flight. The button only tracked the request, which resolves long before General Translation finishes, so the tool looked like the click had not registered. It now reads "Translating…" with a spinner until every enqueued locale reports back, and is disabled meanwhile so the same run cannot be submitted twice. The document-level view already behaved this way.
- **Locale rows showed nothing during a bulk import.** Each row only tracked its own Import button, so `Import All` left every row reading "Ready to import" until it finished. Rows queued by a bulk import now read "Importing…" with a spinner and flip to "Imported" individually as each one lands. `getReadyFilesForImport` accepts an `onSelectedKeys` callback reporting the translation-status keys it selected; those keys index the status map the rows are built from, unlike the keys passed to `onImportSuccess`, which come from the downloaded file and can carry a different version than the one pinned at upload.
