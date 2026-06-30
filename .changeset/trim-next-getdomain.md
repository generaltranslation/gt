---
"gt-next": patch
---

Remove the unused `getDomain` request-function plumbing from `gt-next`.

`getDomain` was scaffolded (a throw-only `internal/_getDomain` stub, a `getDomainPath` config prop, a `getDomain` entry in the request-function registry, and a `_GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED` build env var) but never wired to any runtime consumer — no `getDomain()` request helper exists and nothing reads the env var. Removes the stub module, the `./internal/_getDomain` export, the config prop/registry entries, and the dead env var. `getLocale`/`getRegion` are unchanged.
