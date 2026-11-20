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

if (!(await hasLogin())) {
  await login({
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
  baseUrl: 'https://api.gtx.dev',
  userTokenProvider: createUserTokenProvider(),
});
```

## API

| Export                              | What it does                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `login(options?)`                   | Signs in and stores the session. Uses a device code over SSH, with `noBrowser`, or when no port binds. |
| `logout(options?)`                  | Revokes the session and deletes it locally.                                                            |
| `whoAmI(options?)`                  | Returns the signed-in account's `sub`, `email` and `name`.                                             |
| `hasLogin(options?)`                | Whether a stored login exists for this API. Makes no network request.                                  |
| `createUserTokenProvider(options?)` | A token provider for `createApiClient` that refreshes the access token before it expires.              |
| `UserAuthError`                     | Thrown for every expected failure. `code` says which, and `message` is ready to print.                 |

## Notes

- **One session, for one API.** A login is issued for one API origin, the public General Translation API unless you pass `baseUrl` or set `GT_API_URL`. Logging in to another API replaces the stored session, so pass the same `baseUrl` to `login`, `hasLogin` and `createUserTokenProvider`. A session for a different API is reported as a `resource_mismatch`.
- **Safe to run together.** A login is refreshed by one process at a time, under a lock file beside the credentials file, so commands and tools that share the session can run at once.
- **Messages name the `gt` CLI.** Errors and the browser page say `gt login`, since that command signs in to the shared session from any tool.
- **Warnings.** Two non-fatal conditions (a corrupt credentials file that was reset, and a logout whose remote revocation failed) go to `onWarning`, or to `console.warn` without one.
- **`GT_AUTH_URL` and `GT_API_URL`** override the authorization server and the default API, for local development. A `baseUrl` you pass wins over `GT_API_URL`.
- **Cancelling.** `login` takes an `AbortSignal` as `signal`, and gives up after five minutes without one.
