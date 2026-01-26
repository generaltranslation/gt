import { JsonSchema, YamlSchema } from '../types/index.js';

export function generatePreset(
  preset: JsonSchema['preset'],
  type: 'json'
): JsonSchema;
export function generatePreset(
  preset: YamlSchema['preset'],
  type: 'yaml'
): YamlSchema;
export function generatePreset(
  preset: string | undefined,
  type: 'json' | 'yaml'
): JsonSchema | YamlSchema {
  if (type === 'json') {
    switch (preset) {
      case 'mintlify':
        // https://mintlify.com/docs/navigation
        return {
          composite: {
            '$.navigation.languages': {
              type: 'array',
              key: '$.language',
              experimentalSort: 'localesAlphabetical',
              include: [
                '$..group',
                '$..tab',
                '$..item',
                '$..anchor',
                '$..dropdown',
              ],
              transform: {
                '$..pages[*]': {
                  match: '^{locale}/(.*)$',
                  replace: '{locale}/$1',
                },
              },
            },
            '$.redirects': {
              type: 'array',
              key: '$.language',
              include: [],
              transform: {
                '$.source': {
                  match: '^/{locale}/(.*)$',
                  replace: '/{locale}/$1',
                },
                '$.destination': {
                  match: '^/{locale}/(.*)$',
                  replace: '/{locale}/$1',
                },
              },
            },
          },
        };
      case 'openapi':
        return {
          include: ['$..summary', '$..description'],
        };
      default:
        return {};
    }
  } else {
    switch (preset) {
      case 'mintlify':
        return {
          include: ['$..summary', '$..description'],
        };
      case 'openapi':
        return {
          include: ['$..summary', '$..description'],
        };
      default:
        return {};
    }
  }
}
