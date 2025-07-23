import { describe, it, expect } from 'vitest';
import { flattenJson, unflattenJson } from '../flattenJson.js';
import { readFileSync } from 'fs';
import path from 'path';

describe('flattenJson', () => {
  it('should flatten a JSON file', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file2.json'),
      'utf8'
    );
    const result = flattenJson(JSON.parse(json));
    console.log(result);
    console.log(JSON.stringify(unflattenJson(result), null, 2));
    expect(result).toBeDefined();
  });
  it('should flatten a JSON array', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file3.json'),
      'utf8'
    );
    const result = flattenJson(JSON.parse(json));
    console.log(result);
    console.log(JSON.stringify(unflattenJson(result), null, 2));
    expect(result).toBeDefined();
  });
});
