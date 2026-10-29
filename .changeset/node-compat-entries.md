---
'gt-node': major
---

Move the dictionary (key-based) API to `gt-node/compat`. `getTranslations()` and `TFunctionType` leave the `gt-node` root, and `initializeGT()` (`InitializeGTParams`) no longer accepts `dictionary` or `loadDictionary`. Call `initializeGT()`, then `initializeGTDictionary({ dictionary, loadDictionary })` from `gt-node/compat`, which also exports the `Dictionary*` types.

Migration:

| Before | After |
| --- | --- |
| `import { useTranslations } from 'gt-react'` | `import { useTranslations } from 'gt-react/compat'` |
| `import { GTProvider } from 'gt-react'` with `dictionaries`, `onMissingDictionaryEntry` or `onMissingDictionaryObj` | `import { GTProvider } from 'gt-react/compat'`, which takes the same props |
| `initializeGT({ …, dictionary, loadDictionary })`, `initializeGTSPA({ …, dictionary, loadDictionary })` (gt-react) | `initializeGT({ … })` / `initializeGTSPA({ … })`, then `initializeGTDictionary({ dictionary, loadDictionary, cacheExpiryTime })` from `gt-react/compat`. Pass the `cacheExpiryTime` the dictionaries used before: the one you pass to `initializeGT()`, or `null` where `initializeGT()` defaulted it to `null` (gt-react's browser `initializeGT()`); without it, loaded dictionaries expire after the default 60 seconds |
| `import { useTranslations } from 'gt-react-native'` | `import { useTranslations } from 'gt-react-native/compat'` |
| `<GTProvider dictionaries={…}>`, `initializeGT({ …, dictionary, loadDictionary })` (gt-react-native) | `GTProvider` and `initializeGTDictionary({ dictionary, loadDictionary, cacheExpiryTime })` from `gt-react-native/compat`, with the `cacheExpiryTime` you pass to `initializeGT()` |
| `import { useTranslations } from 'gt-next'` | `import { useTranslations } from 'gt-next/compat'` |
| `import { getTranslations } from 'gt-next/server'` | `import { getTranslations } from 'gt-next/compat/server'` |
| gt-next `GTProvider` streamed dictionaries to client components | import `GTProvider` from `gt-next/compat`. In the Pages Router, also import `withGTServerSideProps` / `withGTStaticProps` from `gt-next/compat`, which add `dictionaries` to page props |
| `import { useTranslations, getTranslations } from 'gt-tanstack-start'` | `import { useTranslations, getTranslations } from 'gt-tanstack-start/compat'`, and import `setupRouterGTIntegration` from `gt-tanstack-start/compat` instead of `gt-tanstack-start` |
| `import { getTranslations, type TFunctionType } from 'gt-node'` | `import { getTranslations, type TFunctionType } from 'gt-node/compat'` |
| `initializeGT({ …, dictionary, loadDictionary })` (gt-node) | `initializeGT({ … })`, then `initializeGTDictionary({ dictionary, loadDictionary, cacheExpiryTime })` from `gt-node/compat`, with the `cacheExpiryTime` you pass to `initializeGT()` |
| `import type { Dictionary, DictionaryEntry, …, TFunctionType } from 'gt-i18n'` | import the `Dictionary*` types from your framework's `/compat` entry (they also moved to `gt-i18n/internal`) |
