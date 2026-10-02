---
'gt': minor
---

Add `gt api --list` to print every API operation as `METHOD path operationId summary`, and accept an endpoint with `gt api --spec <endpoint>` to print only the matching operations with schema references resolved. The endpoint can be an operation ID, a spec path, or a concrete request path such as `/v2/project/info/abc`.
