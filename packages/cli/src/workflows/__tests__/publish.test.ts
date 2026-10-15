import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/index.js';
import { api } from '../../utils/api.js';
import { logger } from '../../console/logger.js';
import { runPublishWorkflow } from '../publish.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    createSpinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  },
}));

vi.mock('../../utils/api.js', () => ({
  api: { publishFiles: vi.fn() },
}));

const settings = {
  publish: true,
  dashboardUrl: 'https://dash.example.com',
  files: { gtJson: {} },
} as unknown as Settings;

const files = [
  { fileId: 'fr-id', versionId: 'v1', fileName: 'fr.json' },
  { fileId: 'ja-id', versionId: 'v1', fileName: 'ja.json' },
];
const publishMap = new Map([
  ['fr-id', true],
  ['ja-id', true],
]);

describe('runPublishWorkflow', () => {
  beforeEach(() => {
    process.exitCode = undefined;
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('leaves the exit code alone when every file is published', async () => {
    vi.mocked(api.publishFiles).mockResolvedValue({
      results: [
        { fileId: 'fr-id', success: true },
        { fileId: 'ja-id', success: true },
      ],
    } as Awaited<ReturnType<typeof api.publishFiles>>);

    await runPublishWorkflow(files, publishMap, 'branch-id', settings);

    expect(process.exitCode).toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('fails the command when some files are not published', async () => {
    vi.mocked(api.publishFiles).mockResolvedValue({
      results: [
        { fileId: 'fr-id', success: true },
        { fileId: 'ja-id', success: false, error: 'CDN disabled' },
      ],
    } as Awaited<ReturnType<typeof api.publishFiles>>);

    await runPublishWorkflow(files, publishMap, 'branch-id', settings);

    expect(process.exitCode).toBe(1);
    const message = vi.mocked(logger.error).mock.calls[0][0];
    expect(message).toContain('1 file was not published to the CDN');
    expect(message).toContain('ja.json (CDN disabled)');
    expect(message).not.toContain('fr.json');
    expect(message).toContain('https://dash.example.com');
  });

  it('fails the command when the publish request throws', async () => {
    vi.mocked(api.publishFiles).mockRejectedValue(new Error('network down'));

    await runPublishWorkflow(files, publishMap, 'branch-id', settings);

    expect(process.exitCode).toBe(1);
    const message = vi.mocked(logger.error).mock.calls[0][0];
    expect(message).toContain('2 files were not published to the CDN');
    expect(message).toContain('fr.json (network down)');
    expect(message).toContain('ja.json (network down)');
  });
});
