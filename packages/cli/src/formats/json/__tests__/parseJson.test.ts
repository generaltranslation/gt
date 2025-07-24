import { describe, it, expect } from 'vitest';
import { parseJson } from '../parseJson';
import { readFileSync } from 'fs';
import path from 'path';

describe('parseJson', () => {
  it('should parse a JSON file', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file4.json'),
      'utf8'
    );
    const result = parseJson(
      json,
      path.join(__dirname, '../__mocks__', 'test_file4.json'),
      {
        jsonSchema: {
          '**/*.json': {
            include: ['$..*'],
          },
        },
      }
    );
    expect(result).toBeDefined();
    expect(result).toBe(
      '{"/object/key1":"value1","/object/key2":"value2","/object/key3":"value3","/array/0":"value1","/array/1":"value2","/array/2":"value3"}'
    );
  });
  it('should parse a JSON file with a composite schema', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file5.json'),
      'utf8'
    );
    const result = parseJson(
      json,
      path.join(__dirname, '../__mocks__', 'test_file5.json'),
      {
        jsonSchema: {
          '**/*.json': {
            composite: {
              '/object': {
                type: 'object',
                include: ['$..*'],
              },
            },
          },
        },
      }
    );
  });
});
