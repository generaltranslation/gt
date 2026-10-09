// React Server Component counterpart of client-entry.client.ts, matching the
// stubs index.rsc.ts exports for these client components. Exists for the
// Turbopack-specific tree-shaking reason described in client-entry.client.ts.

import { createDiagnosticMessage } from 'generaltranslation/internal';

function failClientComponent(componentName: string): never {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-react',
      severity: 'Error',
      whatHappened: `${componentName} cannot be consumed via the RSC entry point`,
      fix: 'Import this component from a client or server runtime entry point instead.',
    })
  );
}

export function GTProvider() {
  return failClientComponent('GTProvider');
}
export function LocaleSelector() {
  return failClientComponent('LocaleSelector');
}
export function RegionSelector() {
  return failClientComponent('RegionSelector');
}
