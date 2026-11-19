import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

export type UserAuthErrorCode =
  | 'login_required'
  | 'obsolete_credentials'
  | 'resource_mismatch'
  | 'oauth';

/** `message` is a complete `gt Error:` diagnostic; commands print it as-is. */
export class UserAuthError extends Error {
  constructor(
    readonly code: UserAuthErrorCode,
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
