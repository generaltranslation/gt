---
'@generaltranslation/paraglide-js': patch
---

Fix the warnings about missing language tools: a Vue component's pug template that is skipped without `@vue/language-plugin-pug` is now reported, plain Markdown such as a README no longer asks for the Vue tools, and a tool that is installed but fails to load is no longer reported as not installed.
