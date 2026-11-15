---
'@generaltranslation/paraglide-js': minor
---

Add `paraglide-context install <language...>`: it installs the packages that the named languages' files need (for example `svelte2tsx` for `.svelte` files) as dev dependencies, with the project's package manager, and skips the ones already installed. Warnings and errors are now written with `createDiagnosticMessage`, like the other General Translation packages: "paraglide-context Warning: …" and "paraglide-context Error: …".
