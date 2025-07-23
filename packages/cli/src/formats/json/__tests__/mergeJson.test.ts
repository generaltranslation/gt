import { describe, it, expect } from 'vitest';
import { mergeJson } from '../mergeJson';
import { readFileSync } from 'fs';
import path from 'path';

describe('mergeJson', () => {
  it('should parse a JSON file', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file1.json'),
      'utf8'
    );
    const translatedJson = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file1_translated.json'),
      'utf8'
    );
    const result = mergeJson(
      translatedJson,
      json,
      path.join(__dirname, '../__mocks__', 'test_file1.json'),
      {
        jsonSchema: {
          '**/*.json': {
            include: ['navigation.languages[*].global.anchors[*].anchor'],
            transform: {
              'navigation.languages[*].tabs[*].pages[*]': {
                match: '[locale]/(.*)$',
                replace: '[locale]/$1',
                localeProperty: 'code',
                type: 'value',
              },
            },
          },
        },
      }
    );
    console.log(result);
    expect(result).toBeDefined();
  });
});
