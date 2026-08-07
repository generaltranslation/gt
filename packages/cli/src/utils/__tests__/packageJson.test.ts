import { describe, expect, it } from 'vitest';
import {
  getPackageVersion,
  isPackageDeclared,
  isPackageInstalled,
} from '../packageJson.js';

describe('package.json dependency lookup', () => {
  it('does not treat peerDependencies as installed packages', () => {
    const packageJson = {
      peerDependencies: { 'gt-vue': '^0.1.0' },
    };

    expect(isPackageInstalled('gt-vue', packageJson)).toBe(false);
    expect(getPackageVersion('gt-vue', packageJson)).toBeUndefined();
    expect(isPackageDeclared('gt-vue', packageJson)).toBe(true);
  });

  it('does not treat optionalDependencies as installed packages', () => {
    const packageJson = {
      optionalDependencies: { 'gt-vue': '^0.1.0' },
    };

    expect(isPackageInstalled('gt-vue', packageJson)).toBe(false);
    expect(getPackageVersion('gt-vue', packageJson)).toBeUndefined();
    expect(isPackageDeclared('gt-vue', packageJson)).toBe(true);
  });

  it('retains dependencies and devDependencies lookup behavior', () => {
    const packageJson = {
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^7.0.0' },
    };

    expect(isPackageInstalled('react', packageJson)).toBe(true);
    expect(isPackageInstalled('vite', packageJson, true)).toBe(true);
    expect(isPackageInstalled('vite', packageJson, false, true)).toBe(true);
    expect(getPackageVersion('react', packageJson)).toBe('^19.0.0');
    expect(getPackageVersion('vite', packageJson)).toBe('^7.0.0');
  });
});
