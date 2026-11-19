---
'@generaltranslation/auth': minor
'gt': patch
---

- New package `@generaltranslation/auth`: the General Translation account login that `gt` uses, for other command-line tools to share. It exports `login`, `logout`, `whoAmI`, `hasLogin`, `createUserTokenProvider` and `UserAuthError`. Tools built on it share one session with `gt`, so a user who ran `gt login` is signed in to all of them.
- `gt` signs in through `@generaltranslation/auth`. Its commands and stored login are unchanged.
