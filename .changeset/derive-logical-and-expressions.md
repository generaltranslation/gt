---
'gt': patch
---

Support logical `&&` expressions inside `<Derive>`. The CLI's JSX extraction handled ternaries but not `&&`, so content like `{show && <li>...</li>}` wrapped in `<Derive>` errored as children that could change at runtime. A `cond && content` expression now derives two entries — the right-hand content and an empty branch — matching React's render-nothing behavior for falsy conditions. `||` and `??` expressions are unchanged and still require `<Var>`.
