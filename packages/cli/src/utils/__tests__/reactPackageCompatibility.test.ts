import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { REACT_LIBRARIES } from '../../types/libraries.js';
import { checkReactPackageCompatibility } from '../reactPackageCompatibility.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('checkReactPackageCompatibility', () => {
  let projectDirectory: string;
  const originalExit = process.exit;

  beforeEach(() => {
    projectDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-react-compatibility-')
    );
    process.exit = vi.fn() as never;
  });

  afterEach(() => {
    process.exit = originalExit;
    fs.rmSync(projectDirectory, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it.each(REACT_LIBRARIES)(
    'accepts %s at version 11 or later',
    (packageName) => {
      writeProjectPackageJson({ [packageName]: '^11.0.0' });

      checkReactPackageCompatibility(false, projectDirectory);

      expect(logger.error).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    }
  );

  it.each(REACT_LIBRARIES)('rejects %s below version 11', (packageName) => {
    writeProjectPackageJson({ [packageName]: '^10.20.0' });

    checkReactPackageCompatibility(false, projectDirectory);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`${packageName}@^10.20.0`)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ID parameter in translation keys')
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('--ignore-compatibility-checks')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('checks every direct React package dependency', () => {
    writeProjectPackageJson({
      'gt-next': '^11.0.0',
      'gt-react': '~10.20.0',
    });

    checkReactPackageCompatibility(false, projectDirectory);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('gt-react@~10.20.0')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('uses an installed version for workspace dependency specs', () => {
    writeProjectPackageJson({ 'gt-react': 'workspace:*' });
    writeInstalledPackageJson('gt-react', '10.20.0');

    checkReactPackageCompatibility(false, projectDirectory);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('gt-react@10.20.0')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('allows bypassing the check', () => {
    writeProjectPackageJson({ 'gt-react': '^10.20.0' });

    checkReactPackageCompatibility(true, projectDirectory);

    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('does nothing when no React package is present', () => {
    writeProjectPackageJson({ 'gt-node': '^9.0.0' });

    checkReactPackageCompatibility(false, projectDirectory);

    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  function writeProjectPackageJson(dependencies: Record<string, string>) {
    fs.writeFileSync(
      path.join(projectDirectory, 'package.json'),
      JSON.stringify({ dependencies })
    );
  }

  function writeInstalledPackageJson(packageName: string, version: string) {
    const packageDirectory = path.join(
      projectDirectory,
      'node_modules',
      packageName
    );
    fs.mkdirSync(packageDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(packageDirectory, 'package.json'),
      JSON.stringify({ name: packageName, version })
    );
  }
});
