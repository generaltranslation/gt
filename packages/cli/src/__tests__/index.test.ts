import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { main } from '../index.js';
import { determineLibrary } from '../fs/determineFramework/index.js';
import { resolveConfig } from '../config/resolveConfig.js';
import { logger } from '../console/logger.js';

vi.mock('../fs/determineFramework/index.js', () => ({
  determineLibrary: vi.fn(() => ({
    library: 'base',
    additionalModules: [],
  })),
}));

vi.mock('../config/resolveConfig.js', () => ({
  resolveConfig: vi.fn(),
}));

vi.mock('../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock('../cli/base.js', () => ({
  BaseCLI: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    execute: vi.fn(),
  })),
}));

vi.mock('../cli/next.js', () => ({
  NextCLI: vi.fn(),
}));

vi.mock('../cli/react.js', () => ({
  ReactCLI: vi.fn(),
}));

vi.mock('../cli/node.js', () => ({
  NodeCLI: vi.fn(),
}));

vi.mock('../cli/python.js', () => ({
  PythonCLI: vi.fn(),
}));

const mockDetermineLibrary = vi.mocked(determineLibrary);
const mockResolveConfig = vi.mocked(resolveConfig);
const mockWarn = vi.mocked(logger.warn);

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetermineLibrary.mockReturnValue({
      library: 'base',
      additionalModules: [],
    });
  });

  it('warns at startup when no library or file translation config is found', () => {
    mockResolveConfig.mockReturnValue(null);

    main(new Command());

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('No package.json or Python project file found')
    );
  });

  it('suppresses the startup warning when file translation config is present', () => {
    mockResolveConfig.mockReturnValue({
      path: '/test-project/gt.config.json',
      config: {
        files: {
          gt: { output: 'translations/[locale].json' },
          pot: { include: ['locales/*.pot'] },
        },
      },
    });

    main(new Command());

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('does not count files.gt as file translation config', () => {
    mockResolveConfig.mockReturnValue({
      path: '/test-project/gt.config.json',
      config: {
        files: {
          gt: { output: 'translations/[locale].json' },
        },
      },
    });

    main(new Command());

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('No package.json or Python project file found')
    );
  });
});
