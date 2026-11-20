---
'gt': patch
---

`gt` now reads a `children` prop that holds text as the element's text, as the compiler and the runtime do: `<p children="Save" />` is the same element as `<p>Save</p>`. No id that a compiled app looks up changes.

- With `enableAutoJsxInjection`, text in a `children` prop (`children="Save"`, `children={'Save'}` or a static template literal) claims its element for the automatic `<T>`. Before, `gt` extracted nothing for `<Label children="," />`, while the compiled app looked the message up and rendered its source text. An empty or whitespace-only `children` prop is still not translated.
- Inside a message, a `children` prop written in braces with a static value (`<T>Total <b children={'due today'} /></T>`, also a number) is part of the message, as a string `children` prop already was. Before, `gt` left it out, so the message's id differed from the one the app looked up. This also applies to a hand-written `<T children={'Save'} />`.
