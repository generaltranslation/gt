import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { extractSurroundingLines } from '../extractSurroundingLines.js';

vi.mock('node:fs');
const mockFs = vi.mocked(fs);

describe('extractSurroundingLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeFile = (lines: string[]) => lines.join('\n');

  it('should extract surrounding lines for a single-line target', () => {
    const fileContent = makeFile([
      'import React from "react";',
      'import { useGT } from "gt-next";',
      '',
      'function Page() {',
      '  const gt = useGT();',
      '  const greeting = gt("Hello, world!");',
      '  return <div>{greeting}</div>;',
      '}',
    ]);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSurroundingLines('/test/file.tsx', 6, 6, 3);

    expect(result).toEqual({
      above: '\nfunction Page() {\n  const gt = useGT();',
      target: '  const greeting = gt("Hello, world!");',
      below: '  return <div>{greeting}</div>;\n}',
    });
  });

  it('should extract surrounding lines for a multi-line target', () => {
    const fileContent = makeFile([
      'import { T } from "gt-next";',
      '',
      'function Page() {',
      '  return (',
      '    <T>',
      '      <div>',
      '        Hello, world!',
      '      </div>',
      '    </T>',
      '  );',
      '}',
    ]);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSurroundingLines('/test/file.tsx', 5, 9, 2);

    expect(result).toEqual({
      above: 'function Page() {\n  return (',
      target:
        '    <T>\n      <div>\n        Hello, world!\n      </div>\n    </T>',
      below: '  );\n}',
    });
  });

  it('should handle target at the top of the file', () => {
    const fileContent = makeFile([
      'const greeting = gt("Hello!");',
      'const farewell = gt("Goodbye!");',
      'export { greeting, farewell };',
    ]);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSurroundingLines('/test/file.tsx', 1, 1, 5);

    expect(result).toEqual({
      above: '',
      target: 'const greeting = gt("Hello!");',
      below: 'const farewell = gt("Goodbye!");\nexport { greeting, farewell };',
    });
  });

  it('should handle target at the bottom of the file', () => {
    const fileContent = makeFile([
      'import { useGT } from "gt-next";',
      '',
      'const gt = useGT();',
      'const msg = gt("Last line");',
    ]);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSurroundingLines('/test/file.tsx', 4, 4, 5);

    expect(result).toEqual({
      above: 'import { useGT } from "gt-next";\n\nconst gt = useGT();',
      target: 'const msg = gt("Last line");',
      below: '',
    });
  });

  it('should handle n larger than available lines', () => {
    const fileContent = makeFile(['line 1', 'line 2', 'line 3']);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSurroundingLines('/test/file.tsx', 2, 2, 10);

    expect(result).toEqual({
      above: 'line 1',
      target: 'line 2',
      below: 'line 3',
    });
  });

  it('should handle n=0 (no surrounding lines)', () => {
    const fileContent = makeFile(['line 1', 'line 2', 'line 3']);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSurroundingLines('/test/file.tsx', 2, 2, 0);

    expect(result).toEqual({
      above: '',
      target: 'line 2',
      below: '',
    });
  });

  it('should return undefined if the file cannot be read', () => {
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = extractSurroundingLines('/nonexistent/file.tsx', 1, 1, 5);

    expect(result).toBeUndefined();
  });

  it('should return undefined if readFileSync returns non-string', () => {
    mockFs.readFileSync.mockReturnValue(undefined as any);

    const result = extractSurroundingLines('/test/file.tsx', 1, 1, 5);

    expect(result).toBeUndefined();
  });

  it('should handle a single-line file', () => {
    mockFs.readFileSync.mockReturnValue('const x = gt("only line");');

    const result = extractSurroundingLines('/test/file.tsx', 1, 1, 5);

    expect(result).toEqual({
      above: '',
      target: 'const x = gt("only line");',
      below: '',
    });
  });
});
