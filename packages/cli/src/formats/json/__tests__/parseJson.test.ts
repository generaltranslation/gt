import { describe, it, expect } from 'vitest';
import { parseJson } from '../parseJson';
import { readFileSync } from 'fs';
import path from 'path';

describe('parseJson', () => {
  it('should parse a JSON file', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file1.json'),
      'utf8'
    );
    const result = parseJson(
      json,
      path.join(__dirname, '../__mocks__', 'test_file1.json'),
      {
        jsonSchema: {
          '**/*.json': {
            include: ['$.navigation'],
          },
        },
      }
    );
    expect(result).toBeDefined();
  });
});
