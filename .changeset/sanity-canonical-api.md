---
'gt-sanity': patch
---

Use canonical GT operations. Report upload failures in Studio and the console, and exclude failed source uploads from translation and existing-translation uploads. Synchronize the project's default locale with the configured source locale after uploading; warn and continue if the update is forbidden. Studio uses the project's existing default branch and no longer renames it to `main`.
