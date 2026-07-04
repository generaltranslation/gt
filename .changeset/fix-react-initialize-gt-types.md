---
"gt-react": patch
---

Fix the shared types entry re-exporting `initializeGT` from `@generaltranslation/react-core/pure`, which no longer exports it. The alias now points at the local `initializeGTSRA` wrapper like the runtime entries, so `gt-react` typechecks again and `initializeGT` is fully typed instead of degrading to `any`.
