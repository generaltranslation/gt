---
'gt': minor
'@generaltranslation/compiler': minor
---

Extraction and `$_hash` injection for `/unstable` tagged templates support `time()` and accept any expression for a formatting-context option such as `currency` or `timeZone`. Message options (`style`, `unit`, `dateStyle`, `timeStyle`, date and time fields) must still be literals. A message without placeholders, including `msg('Save')`, is one string tree, so its hash changes once.
