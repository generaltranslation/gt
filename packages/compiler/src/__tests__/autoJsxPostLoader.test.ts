import { describe, expect, it, vi } from 'vitest';
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import gtUnplugin, { type GTUnpluginOptions } from '../index';

const source = `import { jsx as make } from 'react/jsx-runtime';
export const Generated = () => make('p', { children: ['Generated ', label] });`;
const context = {
  addWatchFile() {},
  emitFile() {},
  getWatchFiles: () => [],
  parse() {
    throw new Error('Unexpected host parser use');
  },
  warn() {},
  error(message: unknown) {
    throw new Error(String(message));
  },
} as UnpluginBuildContext & UnpluginContext;

function plugin(options: GTUnpluginOptions = {}) {
  return gtUnplugin.raw(
    {
      enableAutoJsxInjection: true,
      disableBuildChecks: true,
      compileTimeHash: false,
      enableMacroTransform: false,
      autoJsxImportSource: 'gt-next',
      logLevel: 'silent',
      ...options,
    },
    { framework: 'webpack' }
  );
}

async function transform(
  code: string,
  id = '/src/generated.raw',
  options: GTUnpluginOptions = {}
) {
  const instance = plugin(options);
  if (typeof instance.transform !== 'function')
    throw new Error('Missing transform hook');
  const result = await instance.transform.call(context, code, id);
  return typeof result === 'string' ? result : (result?.code ?? null);
}

describe('automatic JSX after a custom resource loader', () => {
  it.each([
    '.raw',
    '.mdx',
    '.md',
    '.mjs',
    '.cjs',
    '.jsx?fixture',
    '.vue?type=script',
  ])('inserts into generated React JavaScript from %s', async (extension) => {
    const output = await transform(source, '/src/generated' + extension);
    expect(output).toContain('GtInternalTranslateJsx');
    expect(output).toContain('GtInternalVar');
    expect(output).not.toContain('_hash');
  });

  it('uses the resolved configuration flag in resource selection', async () => {
    const disabled = plugin({ enableAutoJsxInjection: false });
    expect(await disabled.transformInclude?.('/file.raw')).toBe(false);
    expect(await disabled.transformInclude?.('/file.tsx')).toBe(true);
    expect(
      await transform(source, '/file.raw', { enableAutoJsxInjection: false })
    ).toBeNull();
    const configured = gtUnplugin.raw(
      {
        gtConfig: {
          files: { gt: { parsingFlags: { enableAutoJsxInjection: true } } },
        },
      },
      { framework: 'webpack' }
    );
    expect(await configured.transformInclude?.('/file.raw')).toBe(true);
  });

  it.each([
    ['css', '.card { content: "react/jsx-runtime import jsx"; }'],
    ['plain text', 'A document describing import jsx from react/jsx-runtime.'],
    ['string containing JavaScript', JSON.stringify(source)],
    ['comment containing JavaScript', `/* ${source} */`],
    ['raw JSX', 'export const Generated = () => <p>Generated text</p>;'],
    [
      'typed original JSX',
      'type Props = { label: string }; export const Generated = ({label}: Props) => <p>Hello {label}</p>;',
    ],
    [
      'typed runtime calls',
      "import { jsx as make } from 'react/jsx-runtime'; const label: string = 'Ada'; make('p', {children:label});",
    ],
    [
      'custom runtime',
      "import { jsx as make } from '@emotion/react/jsx-runtime'; make('p', {children:'Text'});",
    ],
    [
      'runtime lookalike',
      "import { jsx as make } from 'react/jsx-runtime-extra'; make('p', {children:'Text'});",
    ],
    [
      'namespace runtime',
      "import * as runtime from 'react/jsx-runtime'; runtime.jsx('p', {children:'Text'});",
    ],
    [
      'unrelated named call',
      "import { other as make } from 'react/jsx-runtime'; make('p', {children:'Text'});",
    ],
    [
      'shadowed runtime',
      "import { jsx as make } from 'react/jsx-runtime'; function build(make) { return make('p', {children:'Text'}); }",
    ],
    [
      'unused runtime import',
      "import {jsx} from 'react/jsx-runtime'; export const text = 'Unrelated';",
    ],
    [
      'CommonJS runtime',
      "const runtime = require('react/jsx-runtime'); runtime.jsx('p', {children:'Text'});",
    ],
    [
      'foreign function call',
      "const make = (type, props) => props; make('p', {children:'Text'});",
    ],
  ])('ignores %s without changing the resource', async (_name, code) => {
    expect(await transform(code)).toBeNull();
  });

  it('silently ignores unrelated malformed resources even when diagnostics are enabled', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(
        await transform('/* react import */ @not JavaScript {', '/style.css', {
          logLevel: 'warn',
        })
      ).toBeNull();
      // Plugin construction may warn about a missing gt.config.json; resource
      // parsing itself must not create an error or a second diagnostic.
      expect(error).not.toHaveBeenCalled();
      expect(
        warn.mock.calls.every(([message]) =>
          String(message).includes('No gtConfig found')
        )
      ).toBe(true);
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });

  it('does not enable macros, validation, hashes, or runtime translation for extra extensions', async () => {
    const code =
      source +
      "\nimport {t, T} from 'gt-next'; const message = t`Keep this macro`; make(T, {children:'Manual text'});";
    const output = await transform(code, '/src/generated.raw', {
      enableMacroTransform: true,
      compileTimeHash: true,
      disableBuildChecks: false,
      devHotReload: { strings: true, jsx: true },
    });
    expect(output).toContain('GtInternalTranslateJsx');
    expect(output).toContain('t`Keep this macro`');
    expect(output).not.toContain('_hash');
    expect(output).not.toContain('GtInternalRuntimeTranslate');
    let tagged = 0;
    traverse(parse(output!, { sourceType: 'module' }), {
      TaggedTemplateExpression() {
        tagged++;
      },
    });
    expect(tagged).toBe(1);
  });

  it('requires actual insertion before generating another module', async () => {
    expect(
      await transform(
        "import {jsx} from 'react/jsx-runtime'; jsx('p', {children: value});"
      )
    ).toBeNull();
  });
});
