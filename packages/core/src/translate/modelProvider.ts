import { ModelProvider } from '@generaltranslation/api';
import { createDiagnosticMessage } from '../logging/diagnostics';

export type { ModelProvider };

export const supportedModelProviders =
  /* @__PURE__ */ Object.values(ModelProvider);

export function isModelProvider(value: unknown): value is ModelProvider {
  return supportedModelProviders.includes(value as ModelProvider);
}

/** Throws for a model provider the API does not support; `undefined` passes. */
export function validateModelProvider(
  modelProvider: unknown
): asserts modelProvider is ModelProvider | undefined {
  if (modelProvider === undefined || isModelProvider(modelProvider)) return;
  throw new Error(
    createDiagnosticMessage({
      source: 'generaltranslation',
      severity: 'Error',
      whatHappened: `Unsupported model provider \`${String(modelProvider)}\``,
      fix: `Use one of: ${supportedModelProviders.join(', ')}`,
    })
  );
}
