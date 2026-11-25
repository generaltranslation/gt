---
'@generaltranslation/format': major
'generaltranslation': major
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-tanstack-start': major
---

`CustomMapping` is read-only, and `LocaleConfig.customMapping` is a `CustomMapping`, so the frozen mapping a `GTIntl` keeps type-checks where a `CustomMapping` is expected.

**Breaking:** code that writes to a value typed `CustomMapping` no longer compiles. That includes what `useCustomMapping()` returns. Build the mapping first, or copy one to change it:

```diff
- const mapping: CustomMapping = {};
- mapping.portal_fr = { code: 'fr' };
+ const mapping: CustomMapping = { portal_fr: { code: 'fr' } };

- const mapping = useCustomMapping();
- mapping.fr = 'French';
+ const mapping = { ...useCustomMapping(), fr: 'French' };
```
