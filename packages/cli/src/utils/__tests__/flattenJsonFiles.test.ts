import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSettings } from '../../api/__mocks__/settings.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import flattenJsonFiles from '../flattenJsonFiles.js';

vi.mock('../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('flattenJsonFiles', () => {
  it('rethrows the first observed failure across locale groups', async () => {
    const firstFailure = new Error('failed first');
    const laterFailure = new Error('failed later');
    vi.mocked(createFileMapping).mockReturnValue({
      en: {
        first: 'first.json',
        sibling: 'sibling.json',
      },
      fr: {
        later: 'later.json',
      },
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{"nested":{"key":"value"}}');
    vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (file) => {
      if (file === 'first.json') throw firstFailure;
      if (file === 'later.json') throw laterFailure;
      await new Promise((resolve) => setTimeout(resolve, 5));
    });

    const settings = createMockSettings({
      files: {
        resolvedPaths: { json: ['source.json'] },
        placeholderPaths: { json: ['[locale].json'] },
        transformPaths: {},
      },
    });

    await expect(flattenJsonFiles(settings)).rejects.toBe(firstFailure);
  });
});
