---
'gt-react': patch
---

`gt-react/chunk-translations` finds a translation file again after a deploy renamed it, for a page that stayed open on a host that drops the files of earlier builds. When a file an import needs is missing, the page reads the build's `gt-current.json` once and asks for what the build that is served now names in the file's place: the file of the same chunk where that build differs from the page's in translations alone, and in a build split by module, what that build lists for the import's chunk. In every other case, and on a host that keeps earlier files, nothing changes: a missing file is reported with a warning and its messages render their source. What the page had loaded stays, so it can show translations of both builds.
