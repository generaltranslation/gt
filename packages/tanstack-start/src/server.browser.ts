import { createDiagnosticMessage } from 'generaltranslation/internal';

const serverOnlyError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened: 'A GT server API was called in the browser',
  why: "APIs imported from 'gt-tanstack-start/server' are only available in the TanStack Start server runtime",
  fix: 'Call the API from request middleware, a server route, or a createServerFn() handler.',
});

function serverOnly(): never {
  throw new Error(serverOnlyError);
}

// Global request middleware has no client-side implementation.
export const gtMiddleware = undefined as never;

export const getLocale = serverOnly;
export const getEnableI18n = serverOnly;
export const getGT = serverOnly;
export const getMessages = serverOnly;
export const getTranslations = serverOnly;
