---
'gt-svelte': major
---

`<RelativeTime>` requires `unit` when `value` may be a number.

**Breaking:** `<RelativeTime value={3} />` no longer type-checks; it rendered nothing. Add the unit: `<RelativeTime value={3} unit="day" />`. A date needs none.
