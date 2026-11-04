---
'gt': minor
---

From `main` (gt 2.27.0): `gt --version`, `gt -V`, and `gt -v` print the CLI version instead of failing with "unknown option" (#2600). `gt api-key create --org-id <orgId>` creates an organization API key with your `gt login` session, even when an API key is configured, and `--permission` accepts organization permissions such as `org:context:read`; passing one without `--org-id` fails before any request (#2604).
