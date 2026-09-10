---
'gt': patch
---

Warn clearly when a `<T>` component with an explicit `id` or `hash` prop contains `<Derive>` content. Previously the derive variants tripped the generic "Hashes don't match on two components with the same id" error and every variant was dropped from extraction. Now the CLI keeps all variants and emits a warning explaining that the static `id`/`hash` overrides the lookup behavior for `<Derive>`, leaving the component stuck with one hard-coded option at runtime, with the fix being to remove the prop.
