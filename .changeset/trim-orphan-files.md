---
"gt-tanstack-start": patch
"gt-react-native": patch
"gt-i18n": patch
---

Remove three orphaned, never-imported files:

- `gt-tanstack-start`: `condition-store/WritableConditionStore.ts` (an orphaned local copy; the package uses gt-i18n's writable condition store).
- `gt-react-native`: `utils/utils.ts` (`readAuthFromEnv`, no consumers).
- `gt-i18n`: `i18n-cache/translations-manager/utils/types/translations-manager.ts` (unreferenced `TranslationsManagerConfig` type).
