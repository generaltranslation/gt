---
'gt': patch
---

With `enableAutoJsxInjection`, `gt` now places the automatic `<T>` where the compiler does for children written in braces, as the JSX insertion rules say. Before, the two disagreed on such JSX, so the compiled app looked up a message `gt` had not extracted and rendered its source text. No id that a compiled app looks up changes.

- A string in braces, such as `{' · '}`, `{'Hello'}` or a static template literal, counts as translatable text. `gt` saw only JSX text, so for an element whose only text was written in braces, which is how a separator with spaces around it is usually written, it extracted nothing (`<p>{left}{' · '}{right}</p>`) or a child element's text on its own (`Go back` for `<p><a>Go back</a>{' · '}</p>`).
- An element or fragment in braces, such as `{<b>Bold words</b>}`, is the child element it compiles to. For `<div>Lead {<b>Bold words</b>}</div>`, `gt` placed a second automatic `<T>` inside the braces, extracted `Bold words` on its own and stopped with `Found nested <GtInternalTranslateJsx> component`. It also left an expression inside such an element without its `Var`, and did not count a `Select`, `Plural` or `Derive` in braces when deciding where the `<T>` goes.
