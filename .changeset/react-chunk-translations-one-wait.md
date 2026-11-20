---
'gt-react': patch
---

`gt-react/chunk-translations` waits once on a host that is slow. A dynamic import waits up to ten seconds for its translation files, and each import waited on its own, so a route under lazy layouts cost a page one wait per level before it showed anything. Once the wait for a file has run out, no file is waited for until one has arrived within ten seconds of its own request: an import then runs at once, its files are still requested, and its messages render their source until the files arrive. Each file that is not waited for is reported with a warning. An import that ran while the file that lists its files was late now requests them when that file arrives. Nothing changes while files arrive in time: an import still runs only after its files.
