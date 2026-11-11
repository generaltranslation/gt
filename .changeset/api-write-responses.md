---
'@generaltranslation/api': minor
---

Sync the 2026-10-08.v1 contract: writes return data instead of acknowledgement flags.

- `listProjectApiKeys`, `getProjectApiKey` and `deleteProjectApiKey` are new. A `ProjectApiKey` is `{ id, name, permissions, createdAt, lastUsedAt }`.
- `createProject`, `createBranch`, `createProjectApiKey`, `createOrgApiKey` and `setTag` return the resource itself: `response.project.id` → `response.id`, and likewise for `branch`, `apiKey` and `tag`. A new key is the `ProjectApiKey` fields plus `key`, without `projectId`, `type` or `orgId`.
- `setTag`, `assignContextGroup` and `setContextGlossaryTranslation` no longer return `created` or `outcome`. The status code says it: `201` when the request created the resource, `200` otherwise.
- `translateContent` takes `requests` as an array and returns `{ summary, results }`, with one result per request in request order. A result has `status: 'succeeded'` or `status: 'failed'`, replacing `success`. `generated` is removed with no replacement. `RuntimeTranslationRequest` and `RuntimeTranslationResponse` are now `TranslateContentRequest` and `TranslateContentResponse`.
- Context Management writes no longer return `committed`. Creates and updates return the resource (`createContextGroup().groupId` → `.id`), deletes and unassign return `{ deleted: true }`, and the Glossary and Custom Prompt upserts return `counts` with `items` (`id` and `outcome` per item).
