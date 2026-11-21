import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSettings = vi.hoisted(() => ({ stageTranslations: true }));
vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(async () => ({
    config: 'gt.config.json',
    files: { resolvedPaths: {} },
    stageTranslations: mockSettings.stageTranslations,
  })),
}));
vi.mock('../commands/stage.js', () => ({ handleStage: vi.fn() }));
vi.mock('../commands/upload.js', () => ({ upload: vi.fn() }));
vi.mock('../commands/setupProject.js', () => ({
  handleSetupProject: vi.fn(),
}));
vi.mock('../commands/download.js', () => ({ handleDownload: vi.fn() }));
vi.mock('../../api/saveLocalEdits.js', () => ({
  saveLocalEdits: vi.fn(async () => true),
}));
vi.mock('../commands/utils/validation.js', () => ({
  hasValidCredentials: vi.fn(() => true),
  hasValidServiceLocales: vi.fn(() => true),
}));
vi.mock('../../utils/sharedStaticAssets.js', () => ({
  default: vi.fn(),
  mirrorAssetsToLocales: vi.fn(),
}));
vi.mock('../../console/displayTranslateSummary.js', () => ({
  displayTranslateSummary: vi.fn(),
}));
vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  setBannerAnimation: vi.fn(),
  exitSync: vi.fn(),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    endCommand: vi.fn(),
    setConsoleOutput: vi.fn(),
    setQuiet: vi.fn(),
  },
}));

import { saveLocalEdits } from '../../api/saveLocalEdits.js';
import { displayTranslateSummary } from '../../console/displayTranslateSummary.js';
import { exitSync } from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import {
  clearWarnings,
  getWarnings,
  recordWarning,
} from '../../state/translateWarnings.js';
import { BaseCLI } from '../base.js';

async function run(args: string[]) {
  const program = new Command().exitOverride();
  new BaseCLI(program, 'gt-react').init();
  await program.parseAsync(args, { from: 'user' });
}

describe('standalone command warnings summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
    mockSettings.stageTranslations = true;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it.each([['stage'], ['upload'], ['save-local'], ['setup']])(
    '%s prints the warnings summary and clears it',
    async (command) => {
      recordWarning('failed_upload', 'a.json', 'storage unavailable');

      await run([command]);

      expect(displayTranslateSummary).toHaveBeenCalledTimes(1);
      expect(getWarnings()).toEqual([]);
    }
  );

  it.each([
    ['stage', true],
    ['upload', true],
    ['setup', true],
    ['translate', true],
    ['translate', false],
  ])(
    '%s exits with code 1 when a file failed to upload (stageTranslations: %s)',
    async (command, stageTranslations) => {
      mockSettings.stageTranslations = stageTranslations;
      recordWarning('failed_upload', 'a.json', 'storage unavailable');

      await run([command]);

      expect(process.exitCode).toBe(1);
    }
  );

  it('does not fail the command when only fonts did not sync', async () => {
    recordWarning(
      'failed_font_sync',
      'Fonts',
      'A project API key cannot upload organization fonts'
    );

    await run(['upload']);

    expect(process.exitCode).toBeUndefined();
  });

  it('save-local reports failed edits in its final message', async () => {
    vi.mocked(saveLocalEdits).mockImplementationOnce(async () => {
      recordWarning('failed_edit_save', 'a.md', 'Locale ja: not found');
      return true;
    });

    await run(['save-local']);

    expect(logger.endCommand).not.toHaveBeenCalledWith('Saved local edits');
    expect(logger.endCommand).toHaveBeenCalledWith(
      expect.stringContaining('could not be saved')
    );
    expect(exitSync).not.toHaveBeenCalled();
  });

  it('save-local exits 1 when saving or publishing failed as a whole', async () => {
    vi.mocked(saveLocalEdits).mockResolvedValueOnce(false);

    await run(['save-local']);

    expect(logger.endCommand).toHaveBeenCalledWith(
      expect.stringContaining('could not be saved')
    );
    expect(exitSync).toHaveBeenCalledWith(1);
  });

  it('save-local reports success when nothing failed', async () => {
    await run(['save-local']);

    expect(logger.endCommand).toHaveBeenCalledWith('Saved local edits');
    expect(exitSync).not.toHaveBeenCalled();
  });
});
