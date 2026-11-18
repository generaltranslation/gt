---
'gt-i18n': patch
'gt-svelte': patch
'gt-react': patch
'gt-next': patch
'gt-node': patch
---

`initializeGT()` takes effect when it runs again. gt-i18n kept the first configuration and translation cache it was given, so after a Vite dev server restart the server kept calling the `loadTranslations` of the closed module runner, and every non-default locale failed with `Vite module runner has been closed` until the process restarted.

A second `initializeGT()` in `gt-svelte`, `gt-react` or `gt-react-native` now replaces the configuration and the translation cache, and cached translations load again through the new loader. Call it once per module, not once per request. `gt-next` and `gt-node` keep their first initialization, as before.
