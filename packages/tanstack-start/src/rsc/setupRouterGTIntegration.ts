import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

const routerSetupError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened:
    'setupRouterGTIntegration() cannot be called where server components render',
  why: 'server components render apart from the router that it sets up',
  fix: 'Call it where the app creates its router, in getRouter() of src/router.tsx',
});

export function setupRouterGTIntegration(): never {
  throw new Error(routerSetupError);
}
