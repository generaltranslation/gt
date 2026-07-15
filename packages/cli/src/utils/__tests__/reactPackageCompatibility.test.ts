import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { REACT_LIBRARIES } from '../../types/libraries.js';
import { getPackageJson, getPackageVersion } from '../packageJson.js';
import { checkReactPackageCompatibility } from '../reactPackageCompatibility.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../packageJson.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../packageJson.js')>();
  return {
    ...actual,
    getPackageJson: vi.fn(),
    getPackageVersion: vi.fn(actual.getPackageVersion),
  };
});

const mockGetPackageJson = vi.mocked(getPackageJson);
const mockGetPackageVersion = vi.mocked(getPackageVersion);
const originalExit = process.exit;

describe('checkReactPackageCompatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn() as never;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it.each(REACT_LIBRARIES)(
    'accepts %s at declared major version 11',
    async (packageName) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { [packageName]: '^11.0.0' },
      });

      await checkReactPackageCompatibility();

      expect(logger.error).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    }
  );

  it.each(REACT_LIBRARIES)(
    'rejects %s below declared major version 11',
    async (packageName) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { [packageName]: '~10.20.0' },
      });

      await checkReactPackageCompatibility();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`${packageName}@~10.20.0`)
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('ID parameter in translation keys')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('older compatible version of the GT CLI')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('--ignore-compatibility-checks')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  );

  it('does nothing when no React package is declared', async () => {
    mockGetPackageJson.mockResolvedValue({
      dependencies: { 'gt-node': '^9.0.0' },
    });

    await checkReactPackageCompatibility();

    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it.each(['workspace:*', 'not-a-version', '^'])(
    'skips unknown or malformed version spec %s',
    async (version) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { 'gt-react': version },
      });

      await checkReactPackageCompatibility();

      expect(logger.error).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    }
  );

  it('fails open when package.json cannot be read', async () => {
    mockGetPackageJson.mockRejectedValue(new Error('unreadable'));

    await expect(checkReactPackageCompatibility()).resolves.toBeUndefined();

    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('fails open for malformed dependency metadata', async () => {
    mockGetPackageJson.mockResolvedValue({
      dependencies: { 'gt-react': 10 },
    });

    await expect(checkReactPackageCompatibility()).resolves.toBeUndefined();

    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('fails open when dependency lookup throws', async () => {
    mockGetPackageJson.mockResolvedValue({
      dependencies: { 'gt-react': '^10.0.0' },
    });
    mockGetPackageVersion.mockImplementationOnce(() => {
      throw new Error('unexpected');
    });

    await expect(checkReactPackageCompatibility()).resolves.toBeUndefined();

    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('allows bypassing the check', async () => {
    await checkReactPackageCompatibility(true);

    expect(mockGetPackageJson).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });
});
