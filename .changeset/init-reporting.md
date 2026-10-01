---
'gt': patch
---

`gt init` and `gt configure` reruns that change nothing no longer rewrite `gt.config.json` or the generated `loadTranslations.js`, and no longer list them as completed steps. When `gt.config.json` does change, it keeps its indentation and trailing newline, and the completed step says whether the file was created or updated. If `--defaults` leaves the development credentials question open, the error now asks for `--dev-credentials` or `--no-dev-credentials` and no longer suggests adding `--defaults`. Passing `--no-dev-credentials` with `--live-translations`, or `--dev-credentials` with `--no-live-translations`, now fails before any change instead of ignoring one of the flags.
