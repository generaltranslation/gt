---
'gt-rrweb': major
'@generaltranslation/icu': patch
---

**Breaking:** the `hashMessage` harvest option of gt-rrweb is now `hashSourceText`, since it hashes recorded source text.

```diff
- <GTRecorder harvest={{ loadTranslations, hashMessage }} />
+ <GTRecorder harvest={{ loadTranslations, hashSourceText }} />
```

When a message is formatted without a value for one of its variables, `@generaltranslation/icu` now throws `No value was provided for the variable "name".` instead of `The ICU message variable "name" was not provided.`
