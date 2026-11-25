---
'@generaltranslation/react-core': patch
'gt-react': patch
---

`LocaleSelector` and `RegionSelector` type their props: they take the `<select>` element's props except `value`, `defaultValue`, `onChange` and `children`, which they control, and a passed prop no longer replaces the locale or region they resolved. A prop such as `setLocale={42}` no longer type-checks. `@generaltranslation/react-core/components` exports `InternalLocaleSelectorProps` and `InternalRegionSelectorProps`.
