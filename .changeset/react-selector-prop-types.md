---
'@generaltranslation/react-core': major
'gt-react': major
---

`LocaleSelector` and `RegionSelector` type their props, and a passed prop no longer replaces the locale or region they resolved.

**Breaking:** they took any prop. They now take the `<select>` element's props, and forward a `ref` to it on React 18 as on React 19, except the props they control: `value`, `defaultValue`, `onChange`, `children`, `multiple` and `dangerouslySetInnerHTML`. A prop such as `setLocale={42}`, or a misspelled one, no longer type-checks; remove it.
