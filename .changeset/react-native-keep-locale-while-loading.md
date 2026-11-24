---
'gt-react-native': major
---

`<GTProvider>` is now the same provider gt-react uses without `translations` (`ClientGTProvider` from `@generaltranslation/react-core/components`), given native storage. What changes:

- Changing locale no longer replaces the whole app with `fallback` while the next locale's translations load. The current locale stays on screen until they arrive, whether the change comes from `useSetLocale()` or from a new `locale` prop. The fallback still shows while the first locale loads.
- When a locale's translations fail to load, the locale on screen stays as it was, and choosing the locale again loads it again. A failed load used to change to the locale with no translations, and it could not be loaded again until the app restarted.
- **Breaking:** a `locale`, `region` or `enableI18n` prop is no longer saved to native storage, and its setter changes nothing: with a prop, the app decides. Only a locale the user chooses through `useSetLocale()` is saved, once it has loaded. `onLocaleChange` is called with each locale chosen, so an app that passes `locale` can follow the choice.
- **Breaking:** `GTProviderProps` no longer includes `onMissingTranslation`. Remove the prop: `<GTProvider onMissingTranslation={report}>` becomes `<GTProvider>`. Nothing replaces it; a missing translation is handled the default way.
- **Breaking:** `<GTProvider>` is no longer a Suspense boundary. It used to show `fallback` for anything below it that suspended, such as a `React.lazy` screen; `fallback` now shows only until the first locale has loaded. An app that relied on it wraps its screens itself:

  ```tsx
  <GTProvider fallback={<Loading />}>
    <Suspense fallback={<Loading />}>
      <App />
    </Suspense>
  </GTProvider>
  ```

- `getNativeLocales()` is exported: the device's languages, for an app that follows the device whatever locale was saved earlier: `<GTProvider locale={followDevice ? getNativeLocales() : saved}>`. On Android they are the user's languages in order of preference. On iOS the first entry is the current locale (`NSLocale.currentLocale`), which follows the languages the app itself is localized in, and the user's preferred languages come after it.
