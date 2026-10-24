import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(async () => ({
    config: 'gt.config.json',
    files: {},
    stageTranslations: true,
  })),
}));
vi.mock('../commands/stage.js', () => ({ handleStage: vi.fn() }));
vi.mock('../commands/upload.js', () => ({ upload: vi.fn() }));
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
  });

  it.each([['stage'], ['upload'], ['save-local']])(
    '%s prints the warnings summary and clears it',
    async (command) => {
      recordWarning('failed_upload', 'a.json', 'storage unavailable');

      await run([command]);

      expect(displayTranslateSummary).toHaveBeenCalledTimes(1);
      expect(getWarnings()).toEqual([]);
    }
  );

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
