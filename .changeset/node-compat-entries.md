---
'gt-node': major
---

Move the dictionary (key-based) API to `gt-node/compat`. `getTranslations()` and `TFunctionType` leave the `gt-node` root, and `initializeGT()` (`InitializeGTParams`) no longer accepts `dictionary` or `loadDictionary`. Call `initializeGT()`, then `initializeGTDictionary({ dictionary, loadDictionary })` from `gt-node/compat`, which also exports the `Dictionary*` types.

Migration:

| Before | After |
| --- | --- |
| `import { getTranslations, type TFunctionType } from 'gt-node'` | `import { getTranslations, type TFunctionType } from 'gt-node/compat'` |
| `initializeGT({ …, dictionary, loadDictionary })` (gt-node) | `initializeGT({ … })`, then `initializeGTDictionary({ dictionary, loadDictionary, cacheExpiryTime })` from `gt-node/compat`, with the `cacheExpiryTime` you pass to `initializeGT()` |
