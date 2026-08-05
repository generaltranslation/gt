---
"generaltranslation": patch
"gt-i18n": patch
"@generaltranslation/react-core": patch
"gt-next": patch
---

Add opt-in `<T>` id-tagging (`_tagIds`). When enabled via `withGTConfig(config, { _tagIds: true })`, each `<T>`/`<Tx>` exposes its published-translation hash as a `data-_gt-hash` attribute, so tooling (localized replay, in-context QA) can map a rendered DOM node back to its published translation. Off by default; apps not using it pay nothing. No effect on `gt()` strings, and DOM-only — skipped on React Native.

Span injection is kept to the minimum necessary: when a `<T>` renders a single host element the attribute is placed directly on that element (no wrapper), so `<T>` keeps copying the source 1:1 and stays valid inside parents that reject a `<span>` (e.g. `<tr>`/`<select>`/`<ul>`). A layout-neutral `display:contents` span is injected only when there is no element to carry the attribute (bare text or a fragment).
