---
'gt-next': patch
---

Keep `experimentalCompilerOptions.inlineTranslations`, including any inline `translations` object, out of the runtime config env var, so build-time translations don't end up in it.
