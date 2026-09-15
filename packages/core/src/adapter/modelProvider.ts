import { ModelProvider } from '@generaltranslation/api';

export type { ModelProvider };

export const supportedModelProviders = Object.values(ModelProvider);

export function isModelProvider(value: unknown): value is ModelProvider {
  return supportedModelProviders.includes(value as ModelProvider);
}
