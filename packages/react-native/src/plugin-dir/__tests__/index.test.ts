import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import { plugin } from '..';
import type { PluginOptions } from '../types';

const entryPointFilePath = '/app/src/App.tsx';

function transform({
  code = 'const app = true;',
  excludePolyfills = [],
  forcePolyfills = false,
}: Pick<PluginOptions, 'excludePolyfills' | 'forcePolyfills'> & {
  code?: string;
} = {}) {
  const output = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: entryPointFilePath,
    plugins: [
      [
        plugin,
        {
          entryPointFilePath,
          excludePolyfills,
          forcePolyfills,
          locales: ['en-US'],
        },
      ],
    ],
  })?.code;

  return Array.from(output?.matchAll(/import ["']([^"']+)["'];/g) ?? []).map(
    ([, source]) => source
  );
}

describe('React Native Babel plugin polyfills', () => {
  it('uses capability-detecting polyfills by default', () => {
    const imports = transform();

    expect(imports).toContain('@formatjs/intl-displaynames/polyfill');
    expect(imports).toContain('@formatjs/intl-listformat/polyfill');
    expect(imports).toContain('@formatjs/intl-relativetimeformat/polyfill');
    expect(imports).not.toContain('@formatjs/intl-displaynames/polyfill-force');
    expect(imports).not.toContain('@formatjs/intl-listformat/polyfill-force');
    expect(imports).not.toContain(
      '@formatjs/intl-relativetimeformat/polyfill-force'
    );
  });

  it('forces every supported polyfill when configured with true', () => {
    const imports = transform({ forcePolyfills: true });

    expect(imports).toContain('@formatjs/intl-displaynames/polyfill-force');
    expect(imports).toContain('@formatjs/intl-listformat/polyfill-force');
    expect(imports).toContain(
      '@formatjs/intl-relativetimeformat/polyfill-force'
    );
    expect(imports).not.toContain('@formatjs/intl-displaynames/polyfill');
    expect(imports).not.toContain('@formatjs/intl-listformat/polyfill');
    expect(imports).not.toContain('@formatjs/intl-relativetimeformat/polyfill');
  });

  it('forces only the selected polyfills when configured with an array', () => {
    const imports = transform({
      forcePolyfills: [
        '@formatjs/intl-displaynames/polyfill',
        '@formatjs/intl-relativetimeformat/polyfill',
      ],
    });

    expect(imports).toContain('@formatjs/intl-displaynames/polyfill-force');
    expect(imports).toContain('@formatjs/intl-listformat/polyfill');
    expect(imports).toContain(
      '@formatjs/intl-relativetimeformat/polyfill-force'
    );
    expect(imports).not.toContain('@formatjs/intl-displaynames/polyfill');
    expect(imports).not.toContain('@formatjs/intl-listformat/polyfill-force');
    expect(imports).not.toContain('@formatjs/intl-relativetimeformat/polyfill');
  });

  it('gives excludePolyfills precedence over forcePolyfills', () => {
    const imports = transform({
      excludePolyfills: ['@formatjs/intl-displaynames/polyfill'],
      forcePolyfills: true,
    });

    expect(imports).not.toContain('@formatjs/intl-displaynames/polyfill');
    expect(imports).not.toContain('@formatjs/intl-displaynames/polyfill-force');
    expect(imports).toContain('@formatjs/intl-displaynames/locale-data/en-US');
  });

  it('does not add a forced alias when the normal import already exists', () => {
    const imports = transform({
      code: "import '@formatjs/intl-displaynames/polyfill';",
      forcePolyfills: ['@formatjs/intl-displaynames/polyfill'],
    });

    expect(
      imports.filter((source) => source.includes('intl-displaynames/polyfill'))
    ).toEqual(['@formatjs/intl-displaynames/polyfill']);
  });

  it('does not add a normal alias when the forced import already exists', () => {
    const imports = transform({
      code: "import '@formatjs/intl-displaynames/polyfill-force';",
    });

    expect(
      imports.filter((source) => source.includes('intl-displaynames/polyfill'))
    ).toEqual(['@formatjs/intl-displaynames/polyfill-force']);
  });
});
