---
'gt': patch
---

fix(cli): `gt translate` honors the `dictionary` key from gt.config.json. The translate aggregation previously used only the `--dictionary` flag and otherwise auto-detected `dictionary.{js,json,ts}` in `./` and `./src`, while `gt validate` already read the configured path, so the two commands disagreed. The resolution order is now flag > config > auto-detect, matching `gt validate`.
