---
'gt-sanity': patch
---

Use canonical GT operations. Report upload failures in Studio and the console, and exclude failed source uploads from translation and existing-translation uploads. Synchronize the project's default locale with the configured source locale after uploading; warn and continue if the API key lacks the permission to update it. Studio toasts state the cause of billing, locale, plan, permission and API key errors instead of advising a retry. Checking translation status and downloading translations retry only failures that may clear, and report other errors instead of showing no translations. Studio uses the project's existing default branch and no longer renames it to `main`.
