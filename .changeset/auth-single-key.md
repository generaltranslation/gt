---
'gt': minor
'generaltranslation': patch
---

`gt auth` and the `gt init` wizard no longer ask for a key type; `-t/--key-type` is removed. There is one kind of project API key, and its permissions are checked by the server. The wizard now saves only the project ID and the framework-prefixed `GT_DEV_API_KEY` that enables hot reload and runtime translation in development; it no longer writes `GT_API_KEY`, which belongs in your hosting environment (production runtime translation) or CI secrets, and both commands print that guidance. `gt init` signs you in (`gt login`) first when no API key is configured, so the CLI translates as you. On the `GT` and `GTRuntime` constructors, `devApiKey` is deprecated in favor of `apiKey`.
