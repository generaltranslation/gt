import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseCLI } from '../base.js';
import { generateSettings } from '../../config/generateSettings.js';
import { handleDownload } from '../commands/download.js';
import { postProcessTranslations } from '../commands/translate.js';
import {
  clearDownloaded,
  getNeedsPostprocessing,
} from '../../state/recentDownloads.js';
import { splitMintlifyLanguageRefs } from '../../utils/splitMintlifyLanguageRefs.js';
import { mirrorAssetsToLocales } from '../../utils/sharedStaticAssets.js';
import { displayTranslateSummary } from '../../console/displayTranslateSummary.js';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));
vi.mock('../commands/download.js', () => ({
  handleDownload: vi.fn(),
}));
vi.mock('../commands/translate.js', () => ({
  handleTranslate: vi.fn(),
  postProcessTranslations: vi.fn(),
}));
vi.mock('../../state/recentDownloads.js', () => ({
  getNeedsPostprocessing: vi.fn(),
  clearDownloaded: vi.fn(),
}));
vi.mock('../../utils/splitMintlifyLanguageRefs.js', () => ({
  splitMintlifyLanguageRefs: vi.fn(),
}));
vi.mock('../../utils/sharedStaticAssets.js', () => ({
  default: vi.fn(),
  mirrorAssetsToLocales: vi.fn(),
}));
vi.mock('../../console/displayTranslateSummary.js', () => ({
  displayTranslateSummary: vi.fn(),
}));

const settings = { stageTranslations: true, files: {} };

function createProgram(): Command {
  const program = new Command();
  new BaseCLI(program, 'gt-react').init();
  return program;
}

describe('gt download', () => {
  beforeEach(() => {
    vi.mocked(generateSettings).mockResolvedValue(settings as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('postprocesses the files it downloaded, like translate does', async () => {
    const downloaded = new Set(['docs/es/index.mdx']);
    vi.mocked(getNeedsPostprocessing).mockReturnValue(downloaded);

    await createProgram().parseAsync(['download'], { from: 'user' });

    expect(handleDownload).toHaveBeenCalledOnce();
    expect(postProcessTranslations).toHaveBeenCalledWith(settings, downloaded);
    expect(splitMintlifyLanguageRefs).toHaveBeenCalledWith(settings);
    expect(mirrorAssetsToLocales).toHaveBeenCalledWith(settings);
    expect(displayTranslateSummary).toHaveBeenCalledOnce();
    expect(clearDownloaded).toHaveBeenCalledOnce();
  });

  it('skips postprocessing when nothing was downloaded', async () => {
    vi.mocked(getNeedsPostprocessing).mockReturnValue(new Set());

    await createProgram().parseAsync(['download'], { from: 'user' });

    expect(handleDownload).toHaveBeenCalledOnce();
    expect(postProcessTranslations).not.toHaveBeenCalled();
    expect(mirrorAssetsToLocales).toHaveBeenCalledWith(settings);
  });
});
