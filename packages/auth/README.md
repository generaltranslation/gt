# @generaltranslation/auth

General Translation account login for command-line tools. It signs a user in through the browser (or with a device code over SSH), stores the session, and supplies fresh access tokens to the GT API client.

Every tool built on this package shares one session. A user who ran `gt login` is already signed in to your tool, and a login from your tool signs them in to `gt`. Tokens are stored in `$XDG_STATE_HOME/gt/credentials.json`, which defaults to `~/.local/state/gt/credentials.json`.

Node.js only, ESM only.

## Installation

```bash
npm install @generaltranslation/auth
```

## Quick Start

```ts
import { createApiClient } from '@generaltranslation/api';
import {
  createUserTokenProvider,
  hasLogin,
  login,
} from '@generaltranslation/auth';

const baseUrl = 'https://api.gtx.dev';

if (!(await hasLogin({ baseUrl }))) {
  await login({
    baseUrl,
    onAuthorizationUrl: (url) =>
      console.log(`Opening your browser. If it does not open, visit:\n${url}`),
    onDeviceCode: ({ userCode, verificationUri, verificationUriComplete }) =>
      console.log(
        verificationUriComplete
          ? `Visit ${verificationUriComplete}`
          : `Visit ${verificationUri} and enter ${userCode}`
      ),
  });
}

const client = createApiClient({
  baseUrl,
  userTokenProvider: createUserTokenProvider({ baseUrl }),
});
```

## API

| Export                             | What it does                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `login(options)`                   | Signs in and stores the session. Uses a device code over SSH, with `noBrowser`, or when no port binds. |
| `logout(options?)`                 | Revokes the session and deletes it locally.                                                            |
| `whoAmI(options?)`                 | Returns the signed-in account's `sub`, `email` and `name`.                                             |
| `hasLogin(options)`                | Whether a stored login exists for this API. Makes no network request.                                  |
| `createUserTokenProvider(options)` | A token provider for `createApiClient` that refreshes the access token before it expires.              |
| `UserAuthError`                    | Thrown for every expected failure. `code` says which, and `message` is ready to print.                 |

## Notes

- **`baseUrl` selects the session.** A login is issued for one API origin. Pass the same `baseUrl` to `login`, `hasLogin` and `createUserTokenProvider`; a different one is reported as a `resource_mismatch`.
- **Messages name the `gt` CLI.** Errors and the browser page say `gt login`, since that command signs in to the shared session from any tool.
- **Warnings.** Two non-fatal conditions (a corrupt credentials file that was reset, and a logout whose remote revocation failed) go to `onWarning`, or to `console.warn` without one.
- **`GT_AUTH_URL`** overrides the authorization server, for local development.
