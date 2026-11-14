---
'gt-sanity': patch
---

Use canonical GT operations. Report upload failures in Studio and the console, and exclude failed source uploads from translation and existing-translation uploads. Synchronize the project's default locale with the configured source locale after uploading; warn and continue if the API key lacks the permission to update it. Studio toasts show the API's error message, followed by a hint for billing, locale, plan, permission and API key errors instead of advice to retry. Checking translation status reads only failures that may clear as no translations ready yet, and downloading translations leaves retries to the API transport; both report other errors instead of showing no translations. Studio uses the project's existing default branch and no longer renames it to `main`.
