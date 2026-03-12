import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { extractSourceCode } from '../extractSourceCode.js';

vi.mock('node:fs');
const mockFs = vi.mocked(fs);

describe('extractSourceCode', () => {
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

    const result = extractSourceCode('/test/single-line.tsx', 6, 6, 3);

    expect(result).toEqual({
      before: '\nfunction Page() {\n  const gt = useGT();',
      target: '  const greeting = gt("Hello, world!");',
      after: '  return <div>{greeting}</div>;\n}',
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

    const result = extractSourceCode('/test/multi-line.tsx', 5, 9, 2);

    expect(result).toEqual({
      before: 'function Page() {\n  return (',
      target:
        '    <T>\n      <div>\n        Hello, world!\n      </div>\n    </T>',
      after: '  );\n}',
    });
  });

  it('should handle target at the top of the file', () => {
    const fileContent = makeFile([
      'const greeting = gt("Hello!");',
      'const farewell = gt("Goodbye!");',
      'export { greeting, farewell };',
    ]);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSourceCode('/test/top.tsx', 1, 1, 5);

    expect(result).toEqual({
      before: '',
      target: 'const greeting = gt("Hello!");',
      after: 'const farewell = gt("Goodbye!");\nexport { greeting, farewell };',
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

    const result = extractSourceCode('/test/bottom.tsx', 4, 4, 5);

    expect(result).toEqual({
      before: 'import { useGT } from "gt-next";\n\nconst gt = useGT();',
      target: 'const msg = gt("Last line");',
      after: '',
    });
  });

  it('should handle n larger than available lines', () => {
    const fileContent = makeFile(['line 1', 'line 2', 'line 3']);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSourceCode('/test/large-n.tsx', 2, 2, 10);

    expect(result).toEqual({
      before: 'line 1',
      target: 'line 2',
      after: 'line 3',
    });
  });

  it('should handle n=0 (no surrounding lines)', () => {
    const fileContent = makeFile(['line 1', 'line 2', 'line 3']);

    mockFs.readFileSync.mockReturnValue(fileContent);

    const result = extractSourceCode('/test/zero-n.tsx', 2, 2, 0);

    expect(result).toEqual({
      before: '',
      target: 'line 2',
      after: '',
    });
  });

  it('should return undefined if the file cannot be read', () => {
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = extractSourceCode('/nonexistent/file.tsx', 1, 1, 5);

    expect(result).toBeUndefined();
  });

  it('should return undefined if readFileSync returns non-string', () => {
    mockFs.readFileSync.mockReturnValue(undefined as any);

    const result = extractSourceCode('/test/non-string.tsx', 1, 1, 5);

    expect(result).toBeUndefined();
  });

  it('should handle a single-line file', () => {
    mockFs.readFileSync.mockReturnValue('const x = gt("only line");');

    const result = extractSourceCode('/test/single-line-file.tsx', 1, 1, 5);

    expect(result).toEqual({
      before: '',
      target: 'const x = gt("only line");',
      after: '',
    });
  });
});
