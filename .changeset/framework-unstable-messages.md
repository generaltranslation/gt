---
"@generaltranslation/react-core": minor
"gt-react": minor
"gt-react-native": minor
"gt-next": minor
"gt-tanstack-start": minor
"gt-node": minor
---

Add deferred messages to the framework entries. Each main entry exports `msg`, `mFallback` and the `M` and `Msg` types from `gt-i18n`, plus an `m` beside each `GT`: `useMessages()` wherever `useGT()` is exported (react-core, gt-react, gt-react-native, gt-next and gt-tanstack-start, with the gt-react and gt-next RSC variants waiting for the request locale's translations), and an async `getMessages()` wherever `getGT()` is (`gt-next/server`, `gt-node` and `gt-tanstack-start`). `` m(msg`...`) `` renders the message in the bound locale like `useGT()` and `getGT()` do.
