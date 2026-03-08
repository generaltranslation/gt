import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@generaltranslation/python-extractor', () => ({
  extractFromPythonSource: vi.fn(),
}));

vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
    },
  },
}));

import { extractFromPythonSource } from '@generaltranslation/python-extractor';
import { matchFiles } from '../../../fs/matchFiles.js';
import fs from 'node:fs';
import { createPythonInlineUpdates } from '../createPythonInlineUpdates.js';

const mockExtract = vi.mocked(extractFromPythonSource);
const mockMatchFiles = vi.mocked(matchFiles);
const mockReadFile = vi.mocked(fs.promises.readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPythonInlineUpdates', () => {
  it('returns empty updates when no files match', async () => {
    mockMatchFiles.mockReturnValue([]);

    const result = await createPythonInlineUpdates(undefined);

    expect(result.updates).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('calls extractFromPythonSource for each matched .py file', async () => {
    mockMatchFiles.mockReturnValue(['/app/routes.py', '/app/models.py']);
    mockReadFile.mockResolvedValue('# python code' as any);
    mockExtract.mockReturnValue({
      results: [],
      errors: [],
      warnings: [],
    });

    await createPythonInlineUpdates(undefined);

    expect(mockExtract).toHaveBeenCalledTimes(2);
    expect(mockExtract).toHaveBeenCalledWith('# python code', '/app/routes.py');
    expect(mockExtract).toHaveBeenCalledWith('# python code', '/app/models.py');
  });

  it('maps results through mapExtractionResultsToUpdates', async () => {
    mockMatchFiles.mockReturnValue(['/app/routes.py']);
    mockReadFile.mockResolvedValue('code' as any);
    mockExtract.mockReturnValue({
      results: [
        {
          dataFormat: 'ICU',
          source: 'Hello',
          metadata: { id: 'greeting', filePaths: ['/app/routes.py'] },
        },
      ],
      errors: [],
      warnings: [],
    });

    const result = await createPythonInlineUpdates(undefined);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].source).toBe('Hello');
    expect(result.updates[0].metadata.id).toBe('greeting');
    expect(result.updates[0].metadata.filePaths).toEqual(['/app/routes.py']);
  });

  it('propagates errors and warnings from extractor', async () => {
    mockMatchFiles.mockReturnValue(['/app/routes.py']);
    mockReadFile.mockResolvedValue('code' as any);
    mockExtract.mockReturnValue({
      results: [],
      errors: ['Parse error in line 5'],
      warnings: ['Unused import'],
    });

    const result = await createPythonInlineUpdates(undefined);

    expect(result.errors).toContain('Parse error in line 5');
    expect(result.warnings).toContain('Unused import');
  });

  it('handles extraction errors gracefully', async () => {
    mockMatchFiles.mockReturnValue(['/app/routes.py']);
    mockReadFile.mockResolvedValue('code' as any);
    mockExtract.mockImplementation(() => {
      throw new Error(
        'Not implemented: Python extraction is under development'
      );
    });

    const result = await createPythonInlineUpdates(undefined);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Error extracting from /app/routes.py');
    expect(result.updates).toEqual([]);
  });
});
