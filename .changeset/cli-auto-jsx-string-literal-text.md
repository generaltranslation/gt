---
'gt': patch
---

With `enableAutoJsxInjection`, `gt` now treats text written as a string in braces, such as `{' · '}`, `{'Hello'}` or a static template literal, as translatable text, as the compiler does and as the JSX insertion rules say. Before, `gt` saw only JSX text, so it placed the automatic `<T>` somewhere else than the compiler for an element whose only text was written in braces, which is how a separator with spaces around it is usually written. For `<p>{left}{' · '}{right}</p>` it extracted nothing, and for `<p><a>Go back</a>{' · '}</p>` it extracted `Go back` on its own, while the compiled app looked up the whole of the element's children: those messages were never translated and rendered their source text. `gt` now extracts the message the app looks up. No id that a compiled app looks up changes.
