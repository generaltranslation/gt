---
'@generaltranslation/compiler': patch
---

With `experimentalReplaceSource`, a `t` or `gt` template from `/unstable` whose variables are all `${{ name }}` values now renders without the runtime: `` t`Hello, ${{ name }}!` `` becomes `` `Bonjour, ${name ?? ""} !` `` in a `fr` build and `` `Hello, ${name ?? ""}!` `` in a build for the source locale. That is what the runtime prints for a string, a number, a bigint, a boolean, `null` and `undefined`. A value that is an object, such as a `Date`, still goes to the runtime: the template literal sits behind `typeof name == "object" && name ? t(...) : ...`. Templates with `maxChars`, with a value that has a side effect, or with nothing but a value are compiled as before.
