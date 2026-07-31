---
"generaltranslation": minor
"gt-i18n": minor
"@generaltranslation/react-core": minor
"gt-next": minor
---

Add opt-in `<T>` id-tagging (`_tagIds`). When enabled via `withGTConfig(config, { _tagIds: true })`, each `<T>`/`<Tx>` renders its published-translation hash as a `data-_gt-hash` attribute on a layout-neutral `display:contents` span, so tooling (localized replay, in-context QA) can map a rendered DOM node back to its published translation. Off by default; apps not using it pay nothing (no extra hashing). No effect on `gt()` strings, and DOM-only — skipped on React Native.

The span is suppressed where it would produce invalid HTML nesting: the swc plugin marks any `<T>` whose immediate static JSX parent can't legally contain a `<span>` (`table`/`thead`/`tbody`/`tfoot`/`tr`/`colgroup`/`select`/`optgroup`/`ul`/`ol`/`menu`/`dl`/`hgroup`/`picture`), and the runtime renders those without the span (the translation itself is unaffected) — avoiding hydration mismatches.
