import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { REACT_LIBRARIES } from '../../types/libraries.js';
import { checkReactPackageCompatibility } from '../monorepoVersionCheck.js';

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

  it('falls back to workspace and range version specs', () => {
    writeProjectPackageJson({
      'gt-next': '>=11.0.0 <12',
      'gt-react': 'workspace:^10.20.0',
    });

    checkReactPackageCompatibility(false, projectDirectory);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('gt-react@workspace:^10.20.0')
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('gt-next@>=11.0.0 <12')
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

  it('checks direct dependencies across a monorepo when run at its root', () => {
    writeProjectPackageJson({});
    fs.writeFileSync(path.join(projectDirectory, 'pnpm-lock.yaml'), '');
    writePackageJson(path.join(projectDirectory, 'packages', 'app'), {
      'gt-tanstack-start': '^10.20.0',
    });

    checkReactPackageCompatibility(false, projectDirectory);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('gt-tanstack-start@^10.20.0')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('does not check sibling workspaces when run from a package', () => {
    writeProjectPackageJson({});
    fs.writeFileSync(path.join(projectDirectory, 'pnpm-lock.yaml'), '');
    const nodeAppDirectory = path.join(
      projectDirectory,
      'packages',
      'node-app'
    );
    writePackageJson(nodeAppDirectory, { 'gt-node': '^9.0.0' });
    writePackageJson(path.join(projectDirectory, 'packages', 'react-app'), {
      'gt-react': '^10.20.0',
    });

    checkReactPackageCompatibility(false, nodeAppDirectory);

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

  function writePackageJson(
    directory: string,
    dependencies: Record<string, string>
  ) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ dependencies })
    );
  }
});
