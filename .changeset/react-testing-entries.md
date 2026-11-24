---
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-react-native': minor
---

Add `gt-react/testing` and `gt-react-native/testing`, for unit tests of code that uses GT. Each exports every name its package's main entry exports, needs no setup and no `<GTProvider>`, and renders source text in the default locale. Map the package to it in the test runner:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    // A pattern, so that gt-react-native/plugin and the other subpaths are left alone.
    alias: [{ find: /^gt-react-native$/, replacement: 'gt-react-native/testing' }],
  },
});
```

- `gt-react-native/testing` loads nothing from `react-native`, so it runs in Node, where the main entry cannot be loaded.
- Each has the main entry's type declarations, so code that type-checks against the package type-checks against its testing entry.
- `initializeGT()` and `initializeGTSPA()` keep the app's `defaultLocale`, so source text is formatted by its rules, and load nothing. `<GTProvider>` renders its children.
- `getLocale()` returns the default locale, `getNativeLocales()` an empty list and `getLocaleFromNativeStore()` `null`.

`@generaltranslation/react-core/pure` exports `initializeGTForTesting()`, which is both entries' `initializeGT()`.
