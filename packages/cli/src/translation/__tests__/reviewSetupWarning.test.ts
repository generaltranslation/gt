import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import type { FileToUpload } from 'generaltranslation/types';
import type { Settings } from '../../types/index.js';
import { warnManualReviewSetup } from '../reviewSetupWarning.js';
import { logger } from '../../console/logger.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock('../../utils/gt.js', () => ({
  gt: {
    getProjectInfo: vi.fn(),
  },
}));

import { gt } from '../../utils/gt.js';

const makeSettings = (reviewPaths: string[] = []): Settings =>
  ({
    projectId: 'proj-123',
    dashboardUrl: 'https://dash.generaltranslation.com',
    files: {
      requiresReviewPaths: new Set(
        reviewPaths.map((p) => path.resolve(process.cwd(), p))
      ),
    },
  }) as unknown as Settings;

const normalFile = (fileName: string): FileToUpload =>
  ({
    fileName,
    fileFormat: 'JSON',
    content: '{}',
    fileId: 'f',
    versionId: 'v',
    locale: 'en',
  }) as FileToUpload;

const gtjsonFile = (
  metadata: Record<string, { requires_review?: boolean }>
): FileToUpload =>
  ({
    fileName: '__GT_TEMPLATE__.json',
    fileFormat: 'GTJSON',
    content: '{}',
    formatMetadata: metadata,
    fileId: 'gt',
    versionId: 'v',
    locale: 'en',
  }) as unknown as FileToUpload;

describe('warnManualReviewSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: setting unavailable (older API / no credentials)
    vi.mocked(gt.getProjectInfo).mockRejectedValue(new Error('unavailable'));
  });

  it('does not warn when nothing requires review', async () => {
    await warnManualReviewSetup(makeSettings(), [
      normalFile('a.json'),
      gtjsonFile({ hashA: {} }),
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns with the project settings URL for review-gated normal files', async () => {
    await warnManualReviewSetup(makeSettings(['a.json']), [
      normalFile('a.json'),
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toContain(
      'https://dash.generaltranslation.com/project/proj-123/settings'
    );
  });

  it('does not warn when the review-gated file is not part of the upload', async () => {
    await warnManualReviewSetup(makeSettings(['other.json']), [
      normalFile('a.json'),
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns for review-gated GTJSON components', async () => {
    await warnManualReviewSetup(makeSettings(), [
      gtjsonFile({ hashA: { requires_review: true }, hashB: {} }),
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn for explicitly opted-out GTJSON components', async () => {
    await warnManualReviewSetup(makeSettings(), [
      gtjsonFile({ hashA: { requires_review: false } }),
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not warn when the project has manual review enabled (autoApprove false)', async () => {
    vi.mocked(gt.getProjectInfo).mockResolvedValue({
      autoApprove: false,
    } as Awaited<ReturnType<typeof gt.getProjectInfo>>);
    await warnManualReviewSetup(makeSettings(['a.json']), [
      normalFile('a.json'),
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not fetch project info when nothing requires review', async () => {
    await warnManualReviewSetup(makeSettings(), [normalFile('a.json')]);
    expect(gt.getProjectInfo).not.toHaveBeenCalled();
  });

  // Wrapping may break phrases across lines, so assert on unwrapped text
  const unwrappedWarning = () =>
    (vi.mocked(logger.warn).mock.calls[0][0] as string).replace(/\n/g, ' ');

  it('warns definitively when the project auto-approves', async () => {
    vi.mocked(gt.getProjectInfo).mockResolvedValue({
      autoApprove: true,
    } as Awaited<ReturnType<typeof gt.getProjectInfo>>);
    await warnManualReviewSetup(makeSettings(['a.json']), [
      normalFile('a.json'),
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(unwrappedWarning()).toContain(
      'this project approves new translations automatically'
    );
  });

  it('warns conditionally when the auto-approve setting is unknown', async () => {
    await warnManualReviewSetup(makeSettings(['a.json']), [
      normalFile('a.json'),
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(unwrappedWarning()).toContain('unless auto-approval is turned off');
  });

  it('names the exact dashboard setting in the call to action', async () => {
    vi.mocked(gt.getProjectInfo).mockResolvedValue({
      autoApprove: true,
    } as Awaited<ReturnType<typeof gt.getProjectInfo>>);
    await warnManualReviewSetup(makeSettings(['a.json']), [
      normalFile('a.json'),
    ]);
    expect(unwrappedWarning()).toContain(
      '"Auto approve translations" in your project settings'
    );
  });

  it('wraps the warning into consistent-width lines', async () => {
    await warnManualReviewSetup(makeSettings(['a.json']), [
      normalFile('a.json'),
    ]);
    const textLines = (vi.mocked(logger.warn).mock.calls[0][0] as string)
      .split('\n')
      .slice(0, -1); // last line is the URL, which is never wrapped
    expect(textLines.length).toBeGreaterThanOrEqual(3);
    for (const line of textLines) {
      expect(line.length).toBeLessThanOrEqual(70);
      expect(line.length).toBeGreaterThan(40);
    }
  });
});
