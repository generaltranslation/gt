---
'gt-node': major
---

Move the dictionary (key-based) API to `gt-node/compat`. `getTranslations()` and `TFunctionType` leave the `gt-node` root, and `initializeGT()` (`InitializeGTParams`) no longer accepts `dictionary` or `loadDictionary`. Call `initializeGT()`, then `initializeGTDictionary({ dictionary, loadDictionary })` from `gt-node/compat`, which also exports the `Dictionary*` types.

Migration:

| Before | After |
| --- | --- |
| `import { useTranslations } from 'gt-react'` | `import { useTranslations } from 'gt-react/compat'` |
| `<GTProvider dictionaries={…} onMissingDictionaryEntry={…} onMissingDictionaryObj={…}>` (gt-react) | `<GTProvider>` with `<GTDictionaryProvider dictionaries={…} onMissingDictionaryEntry={…} onMissingDictionaryObj={…}>` from `gt-react/compat` inside or around it |
| `initializeGT({ …, dictionary, loadDictionary })`, `initializeGTSPA({ …, dictionary, loadDictionary })` (gt-react) | `initializeGT({ … })` / `initializeGTSPA({ … })`, then `initializeGTDictionary({ dictionary, loadDictionary, cacheExpiryTime })` from `gt-react/compat`. Pass the `cacheExpiryTime` the dictionaries used before: the one you pass to `initializeGT()`, or `null` where `initializeGT()` defaulted it to `null` (gt-react's browser `initializeGT()`); without it, loaded dictionaries expire after the default 60 seconds |
| `import { useTranslations } from 'gt-react-native'` | `import { useTranslations } from 'gt-react-native/compat'` |
| `<GTProvider dictionaries={…}>`, `initializeGT({ …, dictionary, loadDictionary })` (gt-react-native) | `<GTDictionaryProvider dictionaries={…}>` and `initializeGTDictionary({ dictionary, loadDictionary, cacheExpiryTime })` from `gt-react-native/compat`, with the `cacheExpiryTime` you pass to `initializeGT()` |
| `import { useTranslations } from 'gt-next'` | `import { useTranslations } from 'gt-next/compat'` |
| `import { getTranslations } from 'gt-next/server'` | `import { getTranslations } from 'gt-next/compat/server'` |
| gt-next `<GTProvider>` streamed dictionaries to client components | `<GTProvider><GTDictionaryProvider>{children}</GTDictionaryProvider></GTProvider>`, with `GTDictionaryProvider` from `gt-next/compat`, in an App Router layout |
| `import { useTranslations, getTranslations } from 'gt-tanstack-start'` | `import { useTranslations, getTranslations } from 'gt-tanstack-start/compat'`, and call `setupRouterGTDictionaryIntegration({ router })` from `gt-tanstack-start/compat` in `getRouter()` beside `setupRouterGTIntegration()`; there is no provider to render |
| `import { getTranslations, type TFunctionType } from 'gt-node'` | `import { getTranslations, type TFunctionType } from 'gt-node/compat'` |
| `initializeGT({ …, dictionary, loadDictionary })` (gt-node) | `initializeGT({ … })`, then `initializeGTDictionary({ dictionary, loadDictionary, cacheExpiryTime })` from `gt-node/compat`, with the `cacheExpiryTime` you pass to `initializeGT()` |
| `import type { Dictionary, DictionaryEntry, …, TFunctionType } from 'gt-i18n'` | import the `Dictionary*` types from your framework's `/compat` entry (they also moved to `gt-i18n/internal`) |
