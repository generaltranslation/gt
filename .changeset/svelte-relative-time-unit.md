---
'gt-svelte': patch
---

`<RelativeTime>` requires `unit` when `value` is a number. `<RelativeTime value={3} />` no longer type-checks; it rendered nothing.
