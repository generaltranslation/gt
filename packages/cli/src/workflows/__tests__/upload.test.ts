import { describe, it, expect, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation/types';
import type { Settings } from '../../types/index.js';
import { runUploadFilesWorkflow } from '../upload.js';

vi.mock('../../console/logger.js', () => ({
  logger: { message: vi.fn(), success: vi.fn() },
}));
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));
vi.mock('../../utils/api.js', () => ({ api: {} }));
vi.mock('../utils/syncFonts.js', () => ({ syncFonts: vi.fn() }));
vi.mock('../steps/BranchStep.js', () => ({
  BranchStep: vi.fn(() => ({
    run: vi.fn(async () => ({ currentBranch: { id: 'branch-feature' } })),
  })),
}));
vi.mock('../steps/UploadSourcesStep.js', () => ({
  UploadSourcesStep: vi.fn(() => ({ run: vi.fn() })),
}));
const { uploadTranslationsRun } = vi.hoisted(() => ({
  uploadTranslationsRun: vi.fn(),
}));
vi.mock('../steps/UploadTranslationsStep.js', () => ({
  UploadTranslationsStep: vi.fn(() => ({ run: uploadTranslationsRun })),
}));

const source: FileToUpload = {
  content: '{"hello":"Hello"}',
  fileName: 'en/messages.json',
  fileFormat: 'JSON',
  fileId: 'file-1',
  versionId: 'version-1',
  locale: 'en',
};
const translation: FileToUpload = {
  ...source,
  content: '{"hello":"Bonjour"}',
  fileName: 'fr/messages.json',
  locale: 'fr',
};

describe('runUploadFilesWorkflow', () => {
  it('uploads translations against the resolved current branch', async () => {
    await runUploadFilesWorkflow({
      files: [{ source, translations: [translation] }],
      options: {} as Settings,
    });

    expect(uploadTranslationsRun).toHaveBeenCalledWith({
      files: [
        {
          source: { ...source, branchId: 'branch-feature' },
          translations: [translation],
        },
      ],
    });
  });
});
