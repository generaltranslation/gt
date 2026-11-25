---
'@generaltranslation/compiler': patch
'generaltranslation': patch
---

The compiler plugin no longer parses a module that cannot hold an import it reads. Everything it does to a module starts from an import of a GT entry, or of a JSX function (`jsx`, `jsxs` or `jsxDEV`) from whichever runtime the module is compiled against, so a module whose text holds no GT entry in quotes, none of those three names, and no backslash that an escape could spell one with, is returned as it is, without the parse and the walks of its syntax tree it used to get. What the plugin writes for every other module is unchanged. One thing differs for a skipped module: the plugin no longer logs `Error processing <file>` when it cannot parse a module it has nothing to do in. `generaltranslation/internal` exports `GT_MESSAGE_IMPORT_SOURCES`, the list behind `isGTMessageImportSource`.
