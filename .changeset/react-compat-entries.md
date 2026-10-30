---
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
---

Move the dictionary (key-based) API to `/compat` subpaths. `useTranslations()`, `getTranslations()`, `initializeGTDictionary()` and the `Dictionary*` types now come from `gt-react/compat`, `gt-react-native/compat`, `gt-next/compat` (its export conditions mirror `gt-next`), `gt-next/compat/server` (server-only `getTranslations()`, like `gt-next/server`) and `gt-tanstack-start/compat`. The old exports are removed without stubs, the root `GTProvider` no longer accepts `dictionaries`, `onMissingDictionaryEntry` or `onMissingDictionaryObj`, and `initializeGT()`/`initializeGTSPA()` no longer accept `dictionary` or `loadDictionary`.

Each `/compat` entry exports its own `GTProvider`, which takes everything the root `GTProvider` takes plus those dictionary props, so moving the provider changes only its import. `useTranslations()` reads dictionaries only from it and, under the root `GTProvider`, throws an error that names the `/compat` entry. `initializeGTDictionary()` takes `cacheExpiryTime` like `initializeGT()` and no longer inherits it. In gt-next, the App Router `GTProvider` from `gt-next/compat` also loads the request locale's dictionaries and streams them to client components, as `GTProvider` did; in the Pages Router, `withGTServerSideProps()` and `withGTStaticProps()` from `gt-next/compat` add `dictionaries` to page props for it. In gt-tanstack-start, `setupRouterGTIntegration({ router })` from `gt-tanstack-start/compat` also loads the request locale's dictionary before render and hydrates the browser from that snapshot. Dictionary dev hot reload keeps working.

Apps that only use the native APIs no longer ship any dictionary code. gt-next requires the `gt-next/internal/_dictionary` and `_load-dictionary` aliases only from `gt-next/compat` modules, and the gt-tanstack-start Vite plugin serves the dictionary from its own `internal/_compat-config` virtual module, so your dictionary file is bundled only when you import a `/compat` entry. The webpack rule that parses gt-next's ESM dist as `javascript/auto` now detects the dist through `internal/_load-translations.mjs`. The `dictionary` and `loadDictionaryPath` options of `withGTConfig()`, `gt.config.json` and the Vite plugin are unchanged. gt-next no longer treats a `[defaultLocale].json` or `[languageCode].json` file (for example `en.json`) as the dictionary; name the file `dictionary.json` or set the `dictionary` option.

`@generaltranslation/react-core` keeps the dictionary internals behind its existing entries: `InternalGTProvider` no longer accepts `dictionaries` or `onMissingDictionary*`, `internalInitializeGTSRA()` no longer accepts `dictionary` or `loadDictionary`, and the unused legacy `Dictionary` types are removed. The gt-next `GTProvider` type no longer declares the unused `id` prop.

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
| `import type { Dictionary, DictionaryEntry, …, TFunctionType } from 'gt-i18n'` | import the `Dictionary*` types from your framework's `/compat` entry (they also moved to `gt-i18n/internal/compat`) |
