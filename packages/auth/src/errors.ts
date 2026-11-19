import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

export type UserAuthErrorCode =
  | 'login_required'
  | 'obsolete_credentials'
  | 'resource_mismatch'
  | 'oauth';

/** `message` is a complete `gt Error:` diagnostic; commands print it as-is. */
export class UserAuthError extends Error {
  // Not a parameter property: the loopback process test loads this file
  // under Node's type stripping, which rejects them.
  readonly code: UserAuthErrorCode;
  constructor(
    code: UserAuthErrorCode,
    whatHappened: string,
    fix?: string,
    details?: string
  ) {
    super(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened,
        fix,
        details,
      })
    );
    this.code = code;
    this.name = 'UserAuthError';
  }
}

export function loginRequiredError(): UserAuthError {
  return new UserAuthError(
    'login_required',
    'You are not signed in',
    'Run `gt login` to sign in'
  );
}
