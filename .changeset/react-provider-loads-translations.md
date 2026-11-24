---
'@generaltranslation/react-core': minor
'gt-react': minor
---

`<GTProvider>` can now load translations itself, for an app that renders only in the browser and wants to change locale without reloading the page. Leave out `translations`, as `gt-react-native`'s provider already allows:

```tsx
initializeGT({ ...gtConfig, loadTranslations });

<GTProvider fallback={<Spinner />}>
  <App />
</GTProvider>;
```

- It renders `fallback` until the first locale's translations have loaded. The fallback is inside GT, so it can use `<T>` and the hooks; it renders source text.
- `useSetLocale()` and `<LocaleSelector>` change locale in place: the current locale stays on screen until the next one has loaded, and the choice is saved to the locale cookie once it has.
- When a locale's translations fail to load, the locale on screen stays as it was, and choosing the locale again loads it again.
- `locale` is optional and takes one locale or a list in order of preference. Without it, the provider follows the locale the visitor last chose, then the browser's languages. With it, the app decides: `useSetLocale()` changes nothing and nothing is saved. `region` and `enableI18n` work the same way.
- `onLocaleChange` is called with the supported locale that the one given to `useSetLocale()` or `<LocaleSelector>` resolves to: `fr` for `fr-FR` in an app that lists `fr`. With a `locale` prop, that is how the app learns of the choice and changes the prop.
- It sets `lang` and `dir` on `<html>` for the locale on screen. A provider inside another leaves them to the outer one.
- On a server it renders `fallback`, in the `locale` prop or else the default locale. The browser hydrates the same thing, and only then turns to what the visitor saved.

A `<GTProvider>` that is given `translations`, as server-rendered apps and gt-next and gt-tanstack-start give it, works as before. The new `GTProviderProps` type covers both forms.

The provider itself is `ClientGTProvider` in `@generaltranslation/react-core/components`, which takes the platform's storage as a `ConditionStorage`; gt-react gives it the cookies.
