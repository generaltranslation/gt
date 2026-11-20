---
'@generaltranslation/auth': minor
'gt': patch
---

- New package `@generaltranslation/auth`: the General Translation account login that `gt` uses, for other command-line tools to share. It exports `login`, `logout`, `whoAmI`, `hasLogin`, `createUserTokenProvider` and `UserAuthError`. Tools built on it share one session with `gt`, so a user who ran `gt login` is signed in to all of them.
- `gt` signs in through `@generaltranslation/auth`. Its commands and stored login are unchanged.
- `gt` commands that run at the same time no longer sign you out. Two commands that found the same login expired each sent its refresh token, and the server ends every session when a refresh token is sent twice. A login is now refreshed by one process at a time.
