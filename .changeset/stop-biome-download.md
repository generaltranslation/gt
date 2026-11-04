---
'gt': patch
---

Stop `gt init` from downloading and running Biome on projects that do not have it installed. Setup now formats with Biome only when the project, or its monorepo root, already has `@biomejs/biome` installed.
