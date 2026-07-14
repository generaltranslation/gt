---
'gt-next': patch
---

Make `@generaltranslation/compiler` an optional peer dependency instead of a hard dependency. It is only used by the experimental `experimentalCompilerOptions.type: 'babel'` webpack path, which already degrades gracefully with a warning when the package cannot be resolved. Users who enable the experimental babel compiler must now install `@generaltranslation/compiler` themselves; everyone else saves ~8.5MB of install weight (the compiler plus its Babel toolchain).
