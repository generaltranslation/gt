---
'@generaltranslation/format': major
'generaltranslation': major
---

`CustomMapping` is read-only, and `LocaleConfig.customMapping` is a `CustomMapping`, so the frozen mapping a `GTIntl` keeps type-checks where a `CustomMapping` is expected.

**Breaking:** code that writes to a value typed `CustomMapping` no longer compiles. Build the mapping first, then type it:

```diff
- const mapping: CustomMapping = {};
- mapping.portal_fr = { code: 'fr' };
+ const mapping: CustomMapping = { portal_fr: { code: 'fr' } };
```
