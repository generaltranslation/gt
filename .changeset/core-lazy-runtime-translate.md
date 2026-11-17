---
'generaltranslation': patch
---

`GTRuntime` loads the code that sends a translation request, and the API client it uses, on the first call to `translate()` or `translateMany()`. An app that only constructs a runtime, as every gt-react and gt-next client bundle does, no longer loads the API client with its first chunk: about 6 KB gzip in a client-rendered gt-react app. Both methods were already asynchronous and behave as before; the CommonJS build loads the same code with `require`.
