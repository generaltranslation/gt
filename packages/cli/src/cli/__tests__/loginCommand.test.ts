import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/oauth.js', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  whoAmI: vi.fn(),
}));
vi.mock('../../config/resolveConfig.js', () => ({
  resolveConfig: vi.fn(),
}));
vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    message: vi.fn(),
    endCommand: vi.fn(),
    setConsoleOutput: vi.fn(),
    setQuiet: vi.fn(),
  },
}));

import { login } from '../../auth/oauth.js';
import { logger } from '../../console/logger.js';
import { BaseCLI } from '../base.js';

const verificationUri = 'https://auth.example/device';
const verificationUriComplete = `${verificationUri}?user_code=ABCD-EFGH`;

describe('login device prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([true, false])(
    'prints the prefilled URL when browser=%s',
    async (browser) => {
      vi.mocked(login).mockImplementation(async (options = {}) => {
        options.onDeviceCode?.({
          userCode: 'ABCD-EFGH',
          verificationUri,
          verificationUriComplete,
        });
      });
      const program = new Command().exitOverride();
      new BaseCLI(program, 'base');
      await program.parseAsync(
        browser ? ['login'] : ['login', '--no-browser'],
        {
          from: 'user',
        }
      );
      expect(login).toHaveBeenCalledWith(
        expect.objectContaining({ noBrowser: !browser })
      );
      expect(logger.message).toHaveBeenCalledWith(
        expect.stringContaining(verificationUriComplete)
      );
      expect(logger.message).not.toHaveBeenCalledWith(
        expect.stringContaining('enter the code')
      );
    }
  );

  it('falls back to the plain URL and code when no prefilled URL is supplied', async () => {
    vi.mocked(login).mockImplementation(async (options = {}) => {
      options.onDeviceCode?.({ userCode: 'ABCD-EFGH', verificationUri });
    });
    const program = new Command().exitOverride();
    new BaseCLI(program, 'base');
    await program.parseAsync(['login', '--no-browser'], { from: 'user' });
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining(verificationUri)
    );
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining('enter the code')
    );
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining('ABCD-EFGH')
    );
  });
});
