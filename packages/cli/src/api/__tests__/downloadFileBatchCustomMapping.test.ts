import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { downloadFileBatch } from '../downloadFileBatch.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { configureApiClient } from '../../utils/api.js';
import type { FileStatusTracker } from '../../workflows/steps/PollJobsStep.js';

vi.mock('../../console/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe('downloadFileBatch - custom-mapped alias of a requested locale', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-download-alias-'))
    );
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes both the canonical and the alias output through the real adapter', async () => {
    const wireSelectors: unknown[][] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const { files } = (await new Request(input, init).json()) as {
        files: Array<Record<string, string>>;
      };
      wireSelectors.push(files);
      return Response.json({
        results: files.map((file) => ({
          ...file,
          status: 'ready',
          fileFormat: 'JSON',
          data: Buffer.from('{"hello":"hola"}').toString('base64'),
        })),
      });
    });
    configureApiClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      customMapping: { 'es-alt': { code: 'es' } },
      fetch,
    });
    const file = { branchId: 'branch', fileId: 'file', versionId: 'version' };
    const inputPath = path.join(tempDir, 'en.json');
    const requested = ['es', 'es-alt'].map((locale) => ({
      ...file,
      locale,
      inputPath,
      outputPath: path.join(tempDir, `${locale}.json`),
    }));
    const fileTracker = {
      completed: new Map(
        requested.map(({ locale }) => [
          `branch:file:version:${locale}`,
          { ...file, locale, fileName: inputPath },
        ])
      ),
      inProgress: new Map(),
      failed: new Map(),
      skipped: new Map(),
    } as unknown as FileStatusTracker;

    const result = await downloadFileBatch(
      fileTracker,
      requested,
      createMockSettings({
        configDirectory: tempDir,
        config: path.join(tempDir, 'gt.config.json'),
        defaultLocale: 'en',
        locales: ['es', 'es-alt'],
      })
    );

    expect(wireSelectors).toEqual([[{ ...file, locale: 'es' }]]);
    expect(result.failed).toEqual([]);
    expect(result.successful).toEqual(requested);
    for (const { outputPath } of requested) {
      expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual({
        hello: 'hola',
      });
    }
  });
});
