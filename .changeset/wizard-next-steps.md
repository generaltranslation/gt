---
'gt': patch
---

`gt init` now ends with a single `Done!` followed by numbered next steps for your framework: wrap content in `<T>` or use `useGT()`, add `<LocaleSelector />`, run `npx gt translate`, and start the dev server. It states that setup did not mark any content for translation, and the `--json` result lists the same steps in a new `nextSteps` field. The Next.js App Router spinner and completed step now say they add `GTProvider` instead of claiming to wrap content in `<T>`.
