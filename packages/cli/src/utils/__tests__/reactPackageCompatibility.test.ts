import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { REACT_LIBRARIES } from '../../types/libraries.js';
import { getPackageJson, getPackageVersion } from '../packageJson.js';
import { warnReactPackageCompatibility } from '../reactPackageCompatibility.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
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

describe('warnReactPackageCompatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(REACT_LIBRARIES)(
    'accepts %s at declared major version 11',
    async (packageName) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { [packageName]: '^11.0.0' },
      });

      await warnReactPackageCompatibility();

      expect(logger.warn).not.toHaveBeenCalled();
    }
  );

  it.each(REACT_LIBRARIES)(
    'warns for %s below declared major version 11',
    async (packageName) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { [packageName]: '~10.20.0' },
      });

      await warnReactPackageCompatibility();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`${packageName}@~10.20.0`)
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('gt Warning:')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ID parameter in translation keys')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('version 11 or later')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('install gt@2.14.58')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('--suppress-id-compatibility-warning')
      );
    }
  );

  it('does nothing when no React package is declared', async () => {
    mockGetPackageJson.mockResolvedValue({
      dependencies: { 'gt-node': '^9.0.0' },
    });

    await warnReactPackageCompatibility();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each(['workspace:*', 'not-a-version', '^'])(
    'skips unknown or malformed version spec %s',
    async (version) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { 'gt-react': version },
      });

      await warnReactPackageCompatibility();

      expect(logger.warn).not.toHaveBeenCalled();
    }
  );

  it.each(['<11', '>=10 <11', '=10.20.0', '10.x', '>=10', '^10 || ^11', '*'])(
    'warns for range %s that permits versions below 11',
    async (version) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { 'gt-react': version },
      });

      await warnReactPackageCompatibility();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`gt-react@${version}`)
      );
    }
  );

  it.each(['>=11', '^11', '11.x'])(
    'accepts range %s that only resolves to version 11 or later',
    async (version) => {
      mockGetPackageJson.mockResolvedValue({
        dependencies: { 'gt-react': version },
      });

      await warnReactPackageCompatibility();

      expect(logger.warn).not.toHaveBeenCalled();
    }
  );

  it('fails open when package.json cannot be read', async () => {
    mockGetPackageJson.mockRejectedValue(new Error('unreadable'));

    await expect(warnReactPackageCompatibility()).resolves.toBeUndefined();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fails open for malformed dependency metadata', async () => {
    mockGetPackageJson.mockResolvedValue({
      dependencies: { 'gt-react': 10 },
    });

    await expect(warnReactPackageCompatibility()).resolves.toBeUndefined();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fails open when dependency lookup throws', async () => {
    mockGetPackageJson.mockResolvedValue({
      dependencies: { 'gt-react': '^10.0.0' },
    });
    mockGetPackageVersion.mockImplementationOnce(() => {
      throw new Error('unexpected');
    });

    await expect(warnReactPackageCompatibility()).resolves.toBeUndefined();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('allows suppressing the warning', async () => {
    await warnReactPackageCompatibility(true);

    expect(mockGetPackageJson).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
