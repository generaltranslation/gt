import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  statSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  TARGETS,
  platformPackageName,
  binaryFileName,
  baseVersion,
  generatePlatformPackage,
} from '../../../../scripts/platform-packages.mjs';

const cliPackageJson = {
  name: 'gt',
  version: '2.14.64-bin.0',
  license: 'FSL-1.1-ALv2',
  author: 'General Translation, Inc.',
  repository: {
    type: 'git',
    url: 'git+https://github.com/generaltranslation/gt.git',
  },
  homepage: 'https://generaltranslation.com/',
  bugs: { url: 'https://github.com/generaltranslation/gt/issues' },
};

describe('platform-packages', () => {
  let workDir: string;
  let binariesDir: string;
  let outDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'platform-packages-'));
    binariesDir = join(workDir, 'binaries');
    outDir = join(workDir, 'npm');
    mkdirSync(binariesDir);
    for (const entry of TARGETS) {
      writeFileSync(
        join(binariesDir, binaryFileName('gt', entry.target)),
        'binary-stub'
      );
    }
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('covers exactly the targets built by build-exe.sh', () => {
    expect(TARGETS.map((entry) => entry.target).sort()).toEqual([
      'darwin-arm64',
      'darwin-x64',
      'linux-arm64',
      'linux-x64',
      'win32-x64',
    ]);
  });

  it('names packages and binaries consistently with the CLI', () => {
    expect(platformPackageName('gt', 'darwin-arm64')).toBe(
      '@generaltranslation/gt-darwin-arm64'
    );
    expect(platformPackageName('gtx-cli', 'linux-x64')).toBe(
      '@generaltranslation/gtx-cli-linux-x64'
    );
    expect(binaryFileName('gt', 'darwin-arm64')).toBe('gt-darwin-arm64');
    expect(binaryFileName('gt', 'win32-x64')).toBe('gt-win32-x64.exe');
    expect(binaryFileName('gtx-cli', 'win32-x64')).toBe(
      'gtx-cli-win32-x64.exe'
    );
  });

  it('strips only the -bin.N suffix from versions', () => {
    expect(baseVersion('2.14.64-bin.0')).toBe('2.14.64');
    expect(baseVersion('2.14.64-bin.3')).toBe('2.14.64');
    expect(baseVersion('2.14.64')).toBe('2.14.64');
    expect(baseVersion('2.15.0-alpha.1')).toBe('2.15.0-alpha.1');
    expect(baseVersion('2.15.0-alpha.1-bin.0')).toBe('2.15.0-alpha.1');
    expect(baseVersion('2.14.51-odysseus.7')).toBe('2.14.51-odysseus.7');
  });

  it('generates a valid package for every target', () => {
    for (const entry of TARGETS) {
      const dir = generatePlatformPackage(entry, {
        cliPackageJson,
        binariesDir,
        outDir,
      });
      const packageJson = JSON.parse(
        readFileSync(join(dir, 'package.json'), 'utf8')
      );
      expect(packageJson.name).toBe(platformPackageName('gt', entry.target));
      expect(packageJson.version).toBe('2.14.64');
      expect(packageJson.os).toEqual([entry.os]);
      expect(packageJson.cpu).toEqual([entry.cpu]);
      if (entry.os === 'linux') {
        expect(packageJson.libc).toEqual(['glibc']);
      } else {
        expect(packageJson.libc).toBeUndefined();
      }
      expect(packageJson.files).toEqual([binaryFileName('gt', entry.target)]);
      expect(packageJson.license).toBe(cliPackageJson.license);
      expect(packageJson.preferUnplugged).toBe(true);

      const binaryPath = join(dir, binaryFileName('gt', entry.target));
      expect(readFileSync(binaryPath, 'utf8')).toBe('binary-stub');
      if (entry.os !== 'win32') {
        expect(statSync(binaryPath).mode & 0o100).toBeTruthy();
      }
    }
  });

  it('fails clearly when a binary is missing', () => {
    expect(() =>
      generatePlatformPackage(TARGETS[0], {
        cliPackageJson,
        binariesDir: join(workDir, 'does-not-exist'),
        outDir,
      })
    ).toThrow(/Missing binary/);
  });
});
