import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings, TranslateFlags } from '../../../types/index.js';
import type { InlineLibrary } from '../../../types/libraries.js';
import { handleEnqueue } from '../enqueue.js';
import { collectFiles } from '../../../formats/files/collectFiles.js';
import { runEnqueueWorkflow } from '../../../workflows/enqueue.js';

vi.mock('../../../formats/files/collectFiles.js', () => ({
  collectFiles: vi.fn(),
}));

vi.mock('../../../workflows/enqueue.js', () => ({
  runEnqueueWorkflow: vi.fn(),
}));

vi.mock('../utils/validation.js', () => ({
  hasValidCredentials: vi.fn(() => true),
  hasValidLocales: vi.fn(() => true),
}));

vi.mock('../../../translation/reviewSetupWarning.js', () => ({
  warnManualReviewSetup: vi.fn(),
}));

const options = { dryRun: false } as TranslateFlags;
const settings = {
  files: {},
  locales: ['es'],
  defaultLocale: 'en',
} as Settings;

describe.each<InlineLibrary>(['gt-vue', 'gt-react'])(
  'handleEnqueue %s catalog label',
  (inlineLibrary) => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(collectFiles).mockResolvedValue({
        files: [],
        reactComponents: 0,
        inlineLibrary,
        publishMap: new Map(),
      });
      vi.mocked(runEnqueueWorkflow).mockResolvedValue({
        jobData: {},
        locales: ['es'],
        message: 'No files need to be enqueued',
      });
    });

    it('preserves the selected inline framework through logging', async () => {
      await handleEnqueue(options, settings, inlineLibrary);

      expect(runEnqueueWorkflow).toHaveBeenCalledWith({
        files: [],
        options,
        settings,
        inlineLibrary,
      });
    });
  }
);
