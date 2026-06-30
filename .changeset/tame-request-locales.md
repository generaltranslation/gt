---
"gt-next": patch
---

Fallback to the default locale when request locale resolution returns an invalid or unsupported locale. This prevents request-derived locale values from causing runtime errors, and adds `isLocaleSupported()` for apps that want to explicitly reject invalid locale route params.
