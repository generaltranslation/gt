# gt-react-native Style Guide

## Architecture

- React Native i18n library with native Turbo Module bridge (iOS Obj-C++, Android Kotlin, web fallback)
- Babel plugin auto-injects locale polyfills at build time
- `src/` = TS source, `android/` = Kotlin, `ios/` = Obj-C++

## Feature Parity with gt-react

- Both packages are **version-locked** (`.changeset/config.json`) and re-export ~95% of `@generaltranslation/react-core`
- Any API added to one must be mirrored to the other, unless platform-specific (e.g., `LocaleSelector`/`RegionSelector` are DOM-only, `Derive` is DOM-only)
- Compare `packages/react/src/index.ts` vs `packages/react-native/src/index.tsx` to verify parity

## Native Module Rules

Spec file: `src/NativeGtReactNative.ts` (TurboModule interface)

- `getNativeLocales(): string[]` -- device locale list in preference order
- `nativeStoreGet(key: string): string | null` -- read persisted value
- `nativeStoreSet(key: string, value: string): void` -- persist key-value pair

Platform implementations:

- iOS (`ios/GtReactNative.mm`): NSUserDefaults + Locale APIs
- Android (`android/.../GtReactNativeModuleImpl.kt`): SharedPreferences + LocaleList (API 24+)

Rules:

- Native modules are **data bridges only** -- no UI logic
- Always update both iOS and Android together
- Never call `GtReactNative` directly in feature code; use wrapper utilities (`getNativeLocales`, `nativeStore`)
- Return empty arrays/null on errors; never throw

## Export Entry Points

- `src/index.tsx` -- public API (re-exports from react-core + GTProvider). All named, no defaults.
- `src/plugin.ts` -- Babel plugin (`./plugin` subpath)
- `src/internal.ts` -- internal/build-time tools (testLocalePolyfill)

## Persistence Patterns

- Use `nativeStoreGet/Set` wrappers for persistence, never cookies or direct AsyncStorage
- Guard `localStorage` with `typeof localStorage !== 'undefined'` for web fallback
- `useDetermineLocale()` fallback chain: user prop -> native store -> device locales -> defaultLocale
- Always validate and resolve locale aliases before persisting

## GTProvider

- Thin wrapper around react-core's GTProvider
- Injects `ssr: false`, `environment: __DEV__ ? 'development' : 'production'`
- Passes platform hooks: `useDetermineLocale`, `useRegionState`, `readAuthFromEnv`

## Pitfalls

1. Adding exports without mirroring to `gt-react` (or vice versa)
2. Missing web fallback in `getNativeLocales()` / `nativeStore` utilities
3. Bypassing `useDetermineLocale` alias resolution with raw device locale values
4. Persisting unvalidated/unresolved locales to native store
5. Exporting from wrong entry point (public vs plugin vs internal)
