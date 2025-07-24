import { JsonSchema } from '../types/index.js';

export function generatePreset(preset: string): JsonSchema {
  switch (preset) {
    case 'mintlify':
      return {
        composite: {
          '$.navigation.languages': {
            type: 'array',
            key: '$.language',
            include: [
              '$.tabs[*].tab',
              '$.tabs[*].global.anchors[*].anchor',
              '$.tabs[*].groups[*]..group',
            ],
            transform: {
              '$.tabs[*].groups[*]..pages[*]': {
                match: '^{locale}/(.*)$',
                replace: '{locale}/$1',
              },
            },
          },
        },
      };
    default:
      return {};
  }
}
