import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractFromVueSource } from '@generaltranslation/vue-extractor';
import { resolveVueCompilerOptions } from '@generaltranslation/vue-extractor/config';
import { matchFiles } from '../../../fs/matchFiles.js';
import { createVueInlineUpdates } from '../createVueInlineUpdates.js';

vi.mock('@generaltranslation/vue-extractor', () => ({
  extractFromVueSource: vi.fn(),
}));
vi.mock('@generaltranslation/vue-extractor/config', () => ({
  resolveVueCompilerOptions: vi.fn(),
}));
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

const temporaryDirectories: string[] = [];
const parsingFlags = {
  autoderive: false,
  enableAutoJsxInjection: false,
  includeSourceCodeContext: true,
  legacyGtReactImportSource: false,
  viteConfigPath: 'config/vite.custom.ts',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveVueCompilerOptions).mockReturnValue({
    compilerOptions: {},
    errors: [],
  });
});

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('createVueInlineUpdates', () => {
  it('keeps discovery and hashing in the CLI while delegating parsing', async () => {
    const file = createSourceFile('Component.vue', '<template />');
    vi.mocked(matchFiles).mockReturnValue([file]);
    vi.mocked(resolveVueCompilerOptions).mockReturnValue({
      compilerOptions: { whitespace: 'preserve' },
      errors: [],
    });
    vi.mocked(extractFromVueSource).mockResolvedValue({
      results: [
        {
          dataFormat: 'STRING',
          source: 'Hello',
          metadata: { context: 'navigation', filePaths: ['Component.vue'] },
        },
      ],
      errors: [],
      warnings: ['warning'],
    });

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(matchFiles).toHaveBeenCalledWith(process.cwd(), expect.any(Array));
    expect(resolveVueCompilerOptions).toHaveBeenCalledWith(
      process.cwd(),
      undefined,
      { viteConfigPath: 'config/vite.custom.ts' }
    );
    expect(extractFromVueSource).toHaveBeenCalledWith('<template />', file, {
      compilerOptions: { whitespace: 'preserve' },
      includeSourceCodeContext: true,
      projectRoot: process.cwd(),
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(['warning']);
    expect(result.updates).toEqual([
      expect.objectContaining({
        dataFormat: 'STRING',
        source: 'Hello',
        metadata: expect.objectContaining({
          context: 'navigation',
          hash: expect.any(String),
        }),
      }),
    ]);
  });

  it('does not parse files when compiler options cannot be resolved', async () => {
    const file = createSourceFile('Component.vue', '<template />');
    vi.mocked(matchFiles).mockReturnValue([file]);
    vi.mocked(resolveVueCompilerOptions).mockReturnValue({
      compilerOptions: {},
      errors: ['invalid compiler options'],
    });

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(extractFromVueSource).not.toHaveBeenCalled();
    expect(result).toEqual({
      updates: [],
      errors: ['invalid compiler options'],
      warnings: [],
    });
  });
});

function createSourceFile(filename: string, source: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-cli-'));
  temporaryDirectories.push(directory);
  const file = path.join(directory, filename);
  fs.writeFileSync(file, source);
  return file;
}
