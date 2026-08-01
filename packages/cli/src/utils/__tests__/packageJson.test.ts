import { describe, expect, it } from 'vitest';
import { getPackageVersion, isPackageInstalled } from '../packageJson.js';

describe('package.json dependency lookup', () => {
  it('recognizes runtime packages declared through peerDependencies', () => {
    const packageJson = {
      peerDependencies: { 'gt-vue': '^0.1.0' },
    };

    expect(isPackageInstalled('gt-vue', packageJson)).toBe(true);
    expect(getPackageVersion('gt-vue', packageJson)).toBe('^0.1.0');
  });

  it('recognizes runtime packages declared through optionalDependencies', () => {
    const packageJson = {
      optionalDependencies: { 'gt-vue': '^0.1.0' },
    };

    expect(isPackageInstalled('gt-vue', packageJson)).toBe(true);
    expect(getPackageVersion('gt-vue', packageJson)).toBe('^0.1.0');
  });
});
