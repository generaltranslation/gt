import { describe, expect, it } from 'vitest';
import * as reactCoreUnstable from '@generaltranslation/react-core/unstable';
import * as unstable from '../unstable';

describe('gt-react-native/unstable', () => {
  // gt-react/unstable re-exports the same react-core surface (see its
  // react-package test), so matching it here keeps the two packages in parity.
  it('exports the react-core/unstable surface except t', () => {
    expect(Object.keys(unstable).sort()).toEqual(
      Object.keys(reactCoreUnstable)
        .filter((name) => name !== 't')
        .sort()
    );
    expect(unstable.useGT).toBe(reactCoreUnstable.useGT);
  });

  it('publishes ./unstable with the React Native source convention', async () => {
    const { default: packageJson } = await import('../../package.json');

    expect(packageJson.exports['./unstable']).toEqual({
      source: './src/unstable.ts',
      types: './dist/module/unstable.d.ts',
      default: './dist/module/unstable.js',
    });
  });
});
