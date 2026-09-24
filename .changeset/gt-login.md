---
'@generaltranslation/api': minor
'generaltranslation': minor
'gt': minor
---

Add `gt login`, `gt logout`, and `gt whoami`. Login uses openid-client with the seeded public `gt-cli` client, S256 PKCE and a loopback callback against the General Translation dashboard. When `--no-browser` is set or the loopback listener cannot bind, login uses device authorization with a displayed verification code. Device polling and retries follow openid-client policy (not blanket network/all-5xx retries). Signed identity tokens are validated before saving per-server credentials in `$XDG_STATE_HOME/gt/credentials.json` (default `~/.local/state/gt/credentials.json`, 0600); refresh preserves the validated account identity. Obsolete pre-release logins require `gt login` again without resetting other servers' entries. Login requests a token for the project's configured `baseUrl` (`GT_API_URL` overrides), records that resource with the credentials, and the CLI refuses to send a login issued for a different API instead of letting the server reject it. The API client and core request path accept a refreshable user-token provider, used only when no API key is configured — an explicit API key always wins. The former development-key rejection is gone; every `gtx-` key is just a key with its own permissions.
