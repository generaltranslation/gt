---
'gt-react': major
'gt-tanstack-start': major
---

`t()` is only available in client-rendered (SPA) apps, so only SPA code can import it:

- `gt-react` exports `t` only from its browser entry. Its server (Node, `worker`, `workerd`) and `react-server` entries no longer export it, so server-rendered code that imports `t` from `gt-react` fails when the app is built. TypeScript still sees `t`, since every condition except `react-server` shares one declaration file.
- `gt-tanstack-start` no longer exports `t`.
- `gt-react/macros`, which set a global `t`, is removed. Import `t` from `gt-react` in the files that use it. An app that wants the global can define it in its entry module:

  ```ts
  import { t as translate } from 'gt-react';

  declare global {
    var t: typeof translate;
  }
  globalThis.t = translate;
  ```

  The compiler and `gt translate` still recognize a global `` t`…` ``.

In a server-rendered app, client-side code included, replace `import { t } from 'gt-react'` or `import { t } from 'gt-tanstack-start'` with `useGT()` in components, `getGT()` in loaders and server functions, or `msg()` with `m()` from `useMessages()` or `getMessages()`.
