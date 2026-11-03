---
'gt': minor
'generaltranslation': patch
'@generaltranslation/api': patch
---

Add `--org-id <orgId>` to `gt api-key create` to create an organization API key instead of a project key. It always uses your `gt login` session, even when an API key is configured, because API keys cannot create organization keys. `--permission` now also accepts organization permissions such as `org:context:read`, `org:projects:create`, and `project:api_keys:write`; passing one without `--org-id` fails before any request. Project keys are unchanged.

The SDK adds `createOrgApiKey` and the `OrgApiKeyPermission` enum, and the shared API adapter adds `createOrgApiKey`.
