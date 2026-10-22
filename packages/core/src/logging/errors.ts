import { createDiagnosticMessage } from './diagnostics';

const GT_SOURCE = 'GT';

export const noTargetLocaleProvidedError = (functionName: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `Cannot call \`${functionName}\` without a target locale`,
    fix: `Pass the target locale to \`${functionName}()\``,
  });

export const noScopeIdProvidedError = (scope: 'project' | 'org') =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `The ${scope === 'org' ? 'organization' : 'project'} ID must be a non-empty string`,
    fix: `Pass the ${scope === 'org' ? 'organization' : 'project'} ID`,
  });

export const projectKeyWithoutProjectIdError = createDiagnosticMessage({
  source: GT_SOURCE,
  severity: 'Error',
  whatHappened: 'A project API key needs a project ID',
  fix: 'Pass `projectId` to `new GT()` with this key, or use an organization key or user token for account operations',
});
