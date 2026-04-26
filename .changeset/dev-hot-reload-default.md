---
"gt-react": patch
"@generaltranslation/compiler": patch
---

Enable dev hot reload for strings by default in the `gt-react/browser` import. JSX hot reload remains off by default (handled by the `<T>` component). When `devHotReload` is not explicitly configured, strings will now be enabled automatically in development mode.
