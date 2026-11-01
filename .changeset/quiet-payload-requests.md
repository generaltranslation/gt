---
'gt-payload': minor
---

Support Payload v4's createPayloadRequest helper while preserving compatibility with Payload v3's createLocalReq. Allow v4 prereleases in Payload peer dependencies.

Select a separate v4 admin view entry point using DefaultTemplate from @payloadcms/ui/rsc, while keeping the v3 template import isolated.

Restore translation panel and coverage table spacing and colors on v4 using semantic design tokens with v3 and standalone fallbacks. Use button styles and sizes supported by both Payload majors.

Derive the authenticated user type from PayloadRequest so public translation inputs and job/request declarations work with both v3 and v4, which removed the TypedUser export.

Inset the translation drawer content and use compact, version-independent panel spacing with a readable maximum width.
