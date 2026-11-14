---
'gt': minor
---

`gt init` and `gt configure` set up gt-vue and gt-svelte projects like gt-react Vite projects. gt-vue projects can store translations on the GT CDN (`--storage cdn`); switching from local storage asks you to remove the `loadTranslations` option from `initializeGT()` or `initializeGTSPA()`, and in a gt-svelte project from `initializeGT()`, instead of gt-react's `initializeGTSPA()`. In gt-vue projects, the local-storage guidance points to `initializeGT({ loadTranslations })`. With development credentials saved, a gt-vue or gt-svelte Vite project is asked to add `gtVue()` from `gt-vue/vite` or `gtSvelte()` from `gt-svelte/vite` to its Vite plugins, instead of gt-react's `gtReact()`.
