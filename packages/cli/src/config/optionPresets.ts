import { JsonSchema } from '../types/index.js';

export function generatePreset(preset: string): JsonSchema {
  switch (preset) {
    case 'mintlify':
      // https://mintlify.com/docs/navigation
      return {
        composite: {
          '$.navigation.languages': {
            type: 'array',
            key: '$.language',
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
          // Enable this when support multiple language objects in array
          // '$.redirects': {
          //   type: 'array',
          //   key: '$.language',
          //   include: [],
          //   transform: {
          //     '$.source': {
          //       match: '^/{locale}/(.*)$',
          //       replace: '/{locale}/$1',
          //     },
          //     '$.destination': {
          //       match: '^/{locale}/(.*)$',
          //       replace: '/{locale}/$1',
          //     },
          //   },
          // },
        },
      };
    default:
      return {};
  }
}
