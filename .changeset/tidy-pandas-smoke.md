---
'gt-sanity': patch
---

Make the translation dialog's preferences configurable and persistent, stop
reference patching from writing to published documents, and add a debug view.

`autoRefresh`, `autoImport`, `autoPatchReferences`, `autoPublish`, and
`preserveExistingTranslations` are now `gtPlugin` options, and whatever the user
sets in the Studio is remembered in `localStorage` per project and dataset
instead of resetting. Previously the document Translate dialog force-enabled
auto-refresh, auto-patch-references, and auto-publish on every mount, so turning
a switch off only lasted until the dialog was closed.

The Translations tool footer now shows the installed plugin version alongside a
**Debug info** button, which opens the plugin's effective configuration and
offers to copy it: resolved source and target locales, `translationLevel`,
matched documents, ignore/dedupe/skip rules, additional serializers, the active
preferences, the Sanity project and dataset, and whether the secrets document
was found. Intended to be pasted into a support request so a Studio's setup can
be seen without a screenshare. The General Translation API key is never
included — only whether one is set.

Adds `gtStructureItems` and `gtStructure`, opt-in Studio structure helpers that
group a translatable type's documents into a pane per locale instead of listing
every translation alongside its source. The structure tool's layout belongs to
`structureTool()` in the Studio config, so these are composed in rather than
applied by the plugin.

Clarifies the translation status UI:

- Each locale now shows an explicit state — Not translated, Translating…, Ready
  to import, or Imported — instead of a progress bar that could only ever read
  0% or 100%, where 0% meant both "never translated" and "in progress".
- The Translate button stays disabled and reads "Translating…" while a run is
  outstanding, so it cannot be enqueued twice.
- The 10-second status poll no longer raises a toast on every tick; only a
  refresh the user asked for reports back.
- The imported counter reads "N of M imported" against the configured locales.
  It previously divided by the number of currently-ready translations, which
  decays to zero as they are imported — producing "6/0".

**Behavior changes:**

- `autoPublish` and `autoPatchReferences` now default to `false`. Publishing
  puts content in front of readers and cannot be undone by turning the switch
  back off; reference patching edits documents you may consider finished. Set
  either to `true` to keep the previous behavior. Auto-import and auto-refresh
  still default to on, so translations continue to land without extra clicks.
- **Auto-import no longer re-imports translations that were already complete
  when the dialog opened.** It fired for anything the API reported as ready,
  so reopening the Translate dialog silently re-imported every locale in turn,
  rewriting the translated documents and discarding edits made to them. It now
  applies only to translations that complete while the dialog is open, which is
  what "Auto-import when complete" describes. Translating again resets that
  baseline, so a fresh run still imports.
- **Patch References no longer writes to published documents.** It resolved the
  translated document through `findLatestDraft`, which returns the published
  document when no draft exists — the normal state for an already-published
  translation — and patched that id, putting rewritten references live with no
  review step. It now seeds a draft from the published state and patches that,
  matching how internationalized-array imports already behave. The patch also
  no longer includes system fields (`_id`, `_rev`, `_createdAt`, `_updatedAt`).
