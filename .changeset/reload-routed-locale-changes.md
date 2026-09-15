---
'gt-next': patch
'gt-react': patch
---

Read Next.js App Router locale and region values from the server-provided conditions. Locale and region setters write request cookies and keep pending values for the refresh callback; hooks continue reading the current server conditions until a new server snapshot arrives. A rejected locale switch therefore leaves the displayed locale aligned with the server, even when the accepted locale is unchanged.

Use `router.refresh()` for ordinary App Router condition updates. Retain the existing document-reload path for returning to the default locale. Other React integrations keep their existing cookie-backed behavior. This change does not add request-time cookie reads or change App Router's existing `enableI18n` behavior.
