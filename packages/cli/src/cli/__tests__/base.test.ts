import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseCLI } from '../base.js';
import { logger } from '../../console/logger.js';
import { logErrorAndExit } from '../../console/logging.js';
import { createOrUpdateConfig } from '../../fs/config/setupConfig.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    endCommand: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    startCommand: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    createSpinner: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    }),
  },
}));

vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
  promptConfirm: vi.fn(),
  promptMultiSelect: vi.fn().mockResolvedValue([]),
  promptSelect: vi.fn(),
  promptText: vi.fn(),
}));

vi.mock('../../setup/userInput.js', () => ({
  getDesiredLocales: vi.fn().mockResolvedValue({
    defaultLocale: 'en',
    locales: ['es'],
  }),
}));

vi.mock('../../utils/packageJson.js', () => ({
  isPackageInstalled: vi.fn(),
  searchForPackageJson: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../fs/config/setupConfig.js', () => ({
  createOrUpdateConfig: vi.fn().mockResolvedValue(undefined),
}));

class TestCLI extends BaseCLI {
  public runHandleInitCommand() {
    return this.handleInitCommand(false, false, false);
  }
}

describe('BaseCLI setup wizard credentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GT_PROJECT_ID;
    delete process.env.GT_API_KEY;
    delete process.env.GT_DEV_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('continues silently when automatic auth is unavailable', async () => {
    const cli = Object.create(TestCLI.prototype) as TestCLI;

    await expect(cli.runHandleInitCommand()).resolves.toBeUndefined();

    expect(createOrUpdateConfig).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logErrorAndExit).not.toHaveBeenCalled();
  });
});
