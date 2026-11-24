# @generaltranslation/auth

## 0.1.0-samsara.1

### Patch Changes

- 082c21a: Declare the Node.js version the package needs: `engines.node` is `>=20.19.0`. Login combines abort signals with `AbortSignal.any`, which Node.js added in 20.3.0, and the `@noble/hashes` dependency of `generaltranslation` requires Node.js 20.19.0. On an older Node.js, login failed at runtime with `AbortSignal.any is not a function` instead of warning at install time.
- Updated dependencies [8f82244]
- Updated dependencies [fcf06f1]
- Updated dependencies [8f82244]
- Updated dependencies [fa6bee9]
- Updated dependencies [fcf06f1]
- Updated dependencies [e43db74]
- Updated dependencies [3a8cb11]
- Updated dependencies [5b1c74c]
- Updated dependencies [b05e6d7]
- Updated dependencies [5b1c74c]
- Updated dependencies [1a8e58d]
- Updated dependencies [5b1c74c]
  - @generaltranslation/api@0.7.0-samsara.4
  - generaltranslation@10.0.0-samsara.12

## 0.1.0-samsara.0

### Minor Changes

- f253d7f: - New package `@generaltranslation/auth`: the General Translation account login that `gt` uses, for other command-line tools to share. It exports `login`, `logout`, `whoAmI`, `hasLogin`, `createUserTokenProvider` and `UserAuthError`. Tools built on it share one session with `gt`, so a user who ran `gt login` is signed in to all of them.
  - `gt` signs in through `@generaltranslation/auth`. Its commands and stored login are unchanged.
  - `gt` commands that run at the same time no longer sign you out. Two commands that found the same login expired each sent its refresh token, and the server ends every session when a refresh token is sent twice. A login is now refreshed by one process at a time.

### Patch Changes

- Updated dependencies [7d841de]
- Updated dependencies [c8e2b0b]
  - generaltranslation@10.0.0-samsara.11
