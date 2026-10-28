import { ModelProvider } from '@generaltranslation/api';
import { createDiagnosticMessage } from '../logging/diagnostics';

export const supportedModelProviders =
  /* @__PURE__ */ Object.values(ModelProvider);

/** Throws for a model provider the API does not support; `undefined` passes. */
export function validateModelProvider(
  modelProvider: unknown
): asserts modelProvider is ModelProvider | undefined {
  if (
    modelProvider === undefined ||
    supportedModelProviders.includes(modelProvider as ModelProvider)
  )
    return;
  throw new Error(
    createDiagnosticMessage({
      source: 'generaltranslation',
      severity: 'Error',
      whatHappened: `Unsupported model provider \`${String(modelProvider)}\``,
      fix: `Use one of: ${supportedModelProviders.join(', ')}`,
    })
  );
}
