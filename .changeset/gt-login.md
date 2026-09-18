---
'@generaltranslation/api': minor
'generaltranslation': minor
'gt': minor
---

Add `gt login`, `gt logout`, and `gt whoami`. Login uses openid-client with the seeded public `gt-cli` client, S256 PKCE and a loopback callback against the General Translation dashboard. When `--no-browser` is set or the loopback listener cannot bind, login uses device authorization with a displayed verification code. Device polling and retries follow openid-client policy (not blanket network/all-5xx retries). Signed identity tokens are validated before saving per-server credentials in `~/.config/gt/credentials.json` (0600); refresh preserves the validated account identity. Obsolete pre-release logins require `gt login` again without resetting other servers' entries. The API client and core request path accept a refreshable user-token provider, used only when no API key is configured — an explicit API key always wins.
