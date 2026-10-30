---
'@generaltranslation/compiler': patch
---

fix(compiler): reject `void`, `!`, `~` and `typeof` unary children inside `<T>`

They were recorded as the number they apply to (`{void 0}` as `"0"`), so the translation and the locale twins rendered text that the source code does not. They now fail the build with the error already given for a unary child that is not a numeric literal. `-1` and `+1` are unchanged.
