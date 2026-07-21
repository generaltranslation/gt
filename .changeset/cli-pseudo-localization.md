---
'gt': patch
'generaltranslation': patch
---

Add a `--pseudo [locale]` flag to `gt generate` that emits a pseudo-localized translation file (default locale `en-XA`, CLDR "Pseudo-Accents") for layout testing. Literal text is accented and expanded by roughly 40% and each message is wrapped in brackets, while ICU arguments, plural/select structure, tags, JSX variables, and branch markers pass through untouched. `generaltranslation/internal` now exports `traverseIcu` and `printIcuAst`, and `printIcuAst` accepts an `escapeAllPounds` option for lossless reprinting of literal `#` in plural options (default output stays byte-identical for hashing).
