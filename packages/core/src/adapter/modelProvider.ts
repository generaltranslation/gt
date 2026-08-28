import type { EnqueueFileTranslationsData } from '@generaltranslation/api';

export type ModelProvider = NonNullable<
  EnqueueFileTranslationsData['body']['modelProvider']
>;

export const supportedModelProviders = [
  'ANTHROPIC',
  'OPENAI',
  'XAI',
  'GOOGLE',
] as const satisfies readonly ModelProvider[];

const _modelProvidersAreExhaustive: [ModelProvider] extends [
  (typeof supportedModelProviders)[number],
]
  ? true
  : never = true;

export function isModelProvider(value: unknown): value is ModelProvider {
  return (
    typeof value === 'string' &&
    supportedModelProviders.some((provider) => provider === value)
  );
}
