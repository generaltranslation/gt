---
'gt': patch
---

`--dry-run` no longer contacts the General Translation API or changes a file in these commands:

- `gt download --dry-run`, and `gt translate --dry-run` in a project with `stageTranslations`, ran the download: they resolved the branch, queried the API and wrote the translations that were ready, and failed with an API error without credentials. They now list the translations they would request, from the staged entries of `gt-lock.json` or from the files found in the project, with the path each would be written to.
- `gt enqueue --dry-run` and `gt upload --dry-run` sent their requests. They now list the files found in the project.
- `gt stage --dry-run` and `gt enqueue --dry-run` asked the API for the project's auto-approve setting when some content requires review. They no longer ask, and their warning says that new translations are approved automatically unless auto-approval is turned off for the project.
- `gt translate --dry-run`, `gt stage --dry-run` and `gt setup --dry-run` moved the files of `sharedStaticAssets` and rewrote the references to them, `gt translate --dry-run` and `gt download --dry-run` copied them into the locale directories with `mirrorToLocales`, and `gt stage --dry-run` wrote `stageTranslations` to `gt.config.json`. A dry run now does none of these.

A run without `--dry-run` is unchanged.
