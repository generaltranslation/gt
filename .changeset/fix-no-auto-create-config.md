---
'@generaltranslation/cli': patch
---

Fix CLI silently creating `gt.config.json` when running commands like `gt stage` in directories without a config file. Commands that require a config now exit with a clear error message pointing users to `gt init`. Config creation is only handled by the init/setup wizard.
