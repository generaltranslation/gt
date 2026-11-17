---
'@generaltranslation/compiler': patch
---

A production build that embeds translations (`files.gt.inlineTranslations.locales` in `gt.config.json`) now fails when a call site reaches the compiler in a form it cannot embed a translation at. Until now such a build succeeded and showed the source language there, because `inlineTranslations.msgOutput` files leave embedded translations out. Two forms are reported, with the file and line of each call site:

- `<T>` still written as JSX. The compiler reads the calls JSX compiles to, and esbuild and Rolldown run plugins before they compile JSX. In Rolldown, add a plugin ahead of the GT plugin that compiles JSX. The esbuild plugin cannot embed translations of `<T>`: build with Vite, webpack, Rspack or Rollup, write those messages as `t` templates, or remove `files.gt.inlineTranslations`.
- A `t` template, or the `gt` of `useGT()` or `getGT()`, from an `/unstable` entry point that another tool already compiled to a call such as `t(_templateObject())`, as SWC, TypeScript and Babel do when they target ES5. Raise that tool's target so tagged templates stay as written, for example `jsc.target: "es2022"` for SWC.

Builds that embed no translations, development builds and installed packages are not checked.
