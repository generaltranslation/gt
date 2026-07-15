import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { REACT_LIBRARIES } from '../../types/libraries.js';
import { getPackageJson } from '../packageJson.js';
import { checkReactPackageCompatibility } from '../reactPackageCompatibility.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../packageJson.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../packageJson.js')>()),
  getPackageJson: vi.fn(),
}));

const mockGetPackageJson = vi.mocked(getPackageJson);
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

  it('skips unknown version protocols', async () => {
    mockGetPackageJson.mockResolvedValue({
      dependencies: { 'gt-react': 'workspace:*' },
    });

    await checkReactPackageCompatibility();

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
