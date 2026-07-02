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
  metadata: Record<string, { requiresReview?: boolean }>
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
  });

  it('does not warn when nothing requires review', () => {
    warnManualReviewSetup(makeSettings(), [
      normalFile('a.json'),
      gtjsonFile({ hashA: {} }),
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns with the project settings URL for review-gated normal files', () => {
    warnManualReviewSetup(makeSettings(['a.json']), [normalFile('a.json')]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toContain(
      'https://dash.generaltranslation.com/project/proj-123/settings'
    );
  });

  it('does not warn when the review-gated file is not part of the upload', () => {
    warnManualReviewSetup(makeSettings(['other.json']), [normalFile('a.json')]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns for review-gated GTJSON components', () => {
    warnManualReviewSetup(makeSettings(), [
      gtjsonFile({ hashA: { requiresReview: true }, hashB: {} }),
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn for explicitly opted-out GTJSON components', () => {
    warnManualReviewSetup(makeSettings(), [
      gtjsonFile({ hashA: { requiresReview: false } }),
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not warn when the project has manual review enabled (autoApprove false)', () => {
    warnManualReviewSetup(
      makeSettings(['a.json']),
      [normalFile('a.json')],
      false
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  // Wrapping may break phrases across lines, so assert on unwrapped text
  const unwrappedWarning = () =>
    (vi.mocked(logger.warn).mock.calls[0][0] as string).replace(/\n/g, ' ');

  it('warns definitively when the project auto-approves', () => {
    warnManualReviewSetup(
      makeSettings(['a.json']),
      [normalFile('a.json')],
      true
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(unwrappedWarning()).toContain(
      'this project approves new translations automatically'
    );
  });

  it('warns conditionally when the auto-approve setting is unknown', () => {
    warnManualReviewSetup(makeSettings(['a.json']), [normalFile('a.json')]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(unwrappedWarning()).toContain('unless auto-approval is turned off');
  });

  it('names the exact dashboard setting in the call to action', () => {
    warnManualReviewSetup(
      makeSettings(['a.json']),
      [normalFile('a.json')],
      true
    );
    expect(unwrappedWarning()).toContain(
      '"Auto approve translations" in your project settings'
    );
  });

  it('wraps the warning into consistent-width lines', () => {
    warnManualReviewSetup(makeSettings(['a.json']), [normalFile('a.json')]);
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
