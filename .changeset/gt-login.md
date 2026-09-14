---
'@generaltranslation/api': minor
'generaltranslation': minor
'gt': minor
---

Add `gt login`, `gt logout`, and `gt whoami`. Login uses OAuth 2.1 authorization code with PKCE against the General Translation dashboard, registering the CLI as a public client on first use and receiving the redirect on a loopback listener (`--no-browser` prints the URL and accepts the pasted redirect). Tokens are stored per authorization server in `~/.config/gt/credentials.json` (0600) and refreshed silently. The API client and core request path accept a refreshable user-token provider, used only when no API key is configured — an explicit API key always wins.
