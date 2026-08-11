import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import { plugin } from '.';

const entryPointFilePath = '/app/src/App.tsx';

function transform(excludePolyfills: string[] = []) {
  return transformSync('const app = true;', {
    babelrc: false,
    configFile: false,
    filename: entryPointFilePath,
    plugins: [
      [
        plugin,
        {
          entryPointFilePath,
          excludePolyfills,
          locales: ['en-US'],
        },
      ],
    ],
  })?.code;
}

describe('React Native Babel plugin polyfills', () => {
  it('bypasses locale matching for Intl APIs that Hermes does not provide', () => {
    const output = transform();

    expect(output).toContain('@formatjs/intl-displaynames/polyfill-force');
    expect(output).toContain('@formatjs/intl-listformat/polyfill-force');
    expect(output).toContain(
      '@formatjs/intl-relativetimeformat/polyfill-force'
    );
    expect(output).not.toMatch(/intl-displaynames\/polyfill['"]/);
    expect(output).not.toMatch(/intl-listformat\/polyfill['"]/);
    expect(output).not.toMatch(/intl-relativetimeformat\/polyfill['"]/);
  });

  it('keeps existing excludePolyfills values working', () => {
    const output = transform(['@formatjs/intl-displaynames/polyfill']);

    expect(output).not.toContain('@formatjs/intl-displaynames/polyfill');
    expect(output).toContain('@formatjs/intl-displaynames/locale-data/en-US');
  });
});
