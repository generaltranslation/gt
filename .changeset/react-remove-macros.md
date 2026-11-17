---
'gt-react': major
---

Remove the `gt-react/macros` entry. It assigned a global `t` as a side effect of being imported. Apps that want a global `t` now assign it themselves, once, before any module that uses it:

```ts
// before
import 'gt-react/macros';

// after: src/macros.ts, imported first from the app's entry
import { t as translate } from 'gt-react';

declare global {
  var t: typeof translate;
}

globalThis.t = translate;
```

The `TemplateSyncResolutionFunction` type that `gt-react/macros` exported is removed with it; use `typeof t` with `t` from `gt-react` instead.

`gt-react` no longer has a side-effect entry, so its `sideEffects` field is now `false`.
