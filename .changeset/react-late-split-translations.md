---
'gt-react': patch
'@generaltranslation/react-core': patch
---

With `experimentalSplitTranslations`, messages that are on screen now show a translation that arrives after they rendered. A translation file that takes longer than the loader's timeout still renders the source text of its messages first; when the file arrives, mounted `<T>` components and the functions of `useGT()` and `useMessages()` look their translations up again and render them, with no reload. The same happens when a page that stayed open through a deploy loads a file of the new build that holds another translation of a message on screen. A string that the exported `t()` returned keeps its value: at module scope it is computed once, and in a component it is read again when the component renders again.
