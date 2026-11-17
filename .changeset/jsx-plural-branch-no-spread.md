---
'gt': major
'@generaltranslation/compiler': major
---

**Breaking:** a spread attribute on a `<Plural>` or `<Branch>` in translated content, as in `<Plural n={count} {...forms} />`, is now an error in `gt` and the compiler. Both read the props of these components from the source to build the stored content of the enclosing `<T>` and its hash, and a spread hides its props from them: the branches were left out, the runtime hashed the real props, and the translation was never found. Write each prop out on the component. The Vue and Svelte extractors already reported such a spread. A `<Plural>` or `<Branch>` outside translated content is not affected.

With `autoderive`, the compiler now reports an error like this one in a `<T>` even when an earlier child is dynamic content. It used to stop at the dynamic child, which `autoderive` allows, and never reach the error; `gt` already reported it.
