import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { describe, expect, it, vi } from 'vitest';
import { autoJsxLayerLoader } from '../layerLoader';
import { addAutoJsxLayerLoader } from '../addLayerLoader';

function invoke(
  source: string,
  resolved?: string | false,
  error: Error | null = null
) {
  const callback = vi.fn();
  const resolve = vi.fn((_context, _request, done) => done(error, resolved));
  const sourceMap = { version: 3, mappings: 'AAAA', sources: ['input.tsx'] };
  const metadata = { user: true };
  autoJsxLayerLoader.call(
    {
      context: '/project/app',
      rootContext: '/project',
      resourcePath: '/project/app/shared.tsx',
      async: () => callback,
      getResolve: () => resolve,
    },
    source,
    sourceMap,
    metadata
  );
  return { callback, resolve, sourceMap, metadata };
}

describe('Emotion JSX layer bridge', () => {
  it.each([
    ['index.rsc.mjs', 'react'],
    ['index.rsc.js', 'react'],
    ['index.server.mjs', '@emotion/react'],
    ['index.server.js', '@emotion/react'],
    ['index.client.mjs', '@emotion/react'],
    ['index.client.js', '@emotion/react'],
  ])('uses the resolver’s %s entry', (entry, source) => {
    const result = invoke(
      'export const Page = () => <p>Hello</p>;',
      `/project/gt-next/dist/${entry}`
    );
    expect(result.resolve).toHaveBeenCalledWith(
      '/project',
      'gt-next',
      expect.any(Function)
    );
    expect(result.callback).toHaveBeenCalledWith(
      null,
      `export const Page = () => <p>Hello</p>;\n;\n"__GT_AUTO_JSX_IMPORT_SOURCE__:${source}";\n`,
      result.sourceMap,
      result.metadata
    );
  });

  it.each([
    undefined,
    false,
    '/custom/alias.js',
    '/custom/index.rsc.jsx',
    '/custom/index.rsc.mjs?query',
    '/custom/index.server.js.backup',
  ])('rejects an unrecognized resolution %j', (resolved) => {
    const { callback } = invoke('export const value = 1;', resolved);
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0][0].message).toMatch(
      /gt-next \(plugin\).*JSX runtime for this module could not be determined/
    );
    expect(callback.mock.calls[0]).toHaveLength(1);
  });

  it('reports resolver failures instead of guessing a runtime', () => {
    const { callback } = invoke(
      'export const value = 1;',
      undefined,
      new Error('resolution failed')
    );
    expect(callback.mock.calls[0][0].message).toContain('resolution failed');
  });

  it.each([
    'const value = 1',
    'const value = <p>Hello</p>',
    'export default function Page() { return <p>Hello</p> }',
    'const value = <p>Hello</p> // EOF comment',
    '#!/usr/bin/env node\n"use client"; export const Page = () => <p>Hello</p>;',
    '/** @jsxImportSource react */\nexport const Page = () => <p>Hello</p>;',
    'export const Page = () => <p>Hello</p>;;;',
    'function page() { return <p>Hello</p> }\n/* final comment */',
    'do {} while (false)',
    'if (true) {} else {}',
  ])(
    'preserves the original program and offsets before its final marker: %s',
    (source) => {
      const { callback } = invoke(
        source,
        '/project/gt-next/dist/index.rsc.mjs'
      );
      const output: string = callback.mock.calls[0][1];
      expect(output.startsWith(source)).toBe(true);
      const original = parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
      const transformed = parse(output, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
      const marker = transformed.program.body.pop()!;
      const separator = transformed.program.body.at(-1);
      if (
        separator?.type === 'EmptyStatement' &&
        separator.start === marker.start! - 2
      )
        transformed.program.body.pop();
      expect(generate(transformed, { comments: false }).code).toBe(
        generate(original, { comments: false }).code
      );
    }
  );

  it('chooses a layer independently for every compilation of a shared module', () => {
    const source = 'export const Shared = () => <p>Shared text</p>;';
    const rsc = invoke(source, '/project/gt-next/dist/index.rsc.mjs');
    const ssr = invoke(source, '/project/gt-next/dist/index.server.mjs');
    const browser = invoke(source, '/project/gt-next/dist/index.client.mjs');
    expect(rsc.callback.mock.calls[0][1]).toContain('SOURCE__:react');
    expect(ssr.callback.mock.calls[0][1]).toContain('SOURCE__:@emotion/react');
    expect(browser.callback.mock.calls[0][1]).toContain(
      'SOURCE__:@emotion/react'
    );
  });

  it('preserves user rule ordering when the bridge glob collides', () => {
    const pattern = '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,md,mdx}';
    const first = { loaders: ['first-loader'] };
    const later = { loaders: ['later-loader'] };
    const rules = { [pattern]: first, '*.jsx': later };
    const result = addAutoJsxLayerLoader(rules, '/gt-next/loader.js')!;
    expect(Object.keys(result)).toEqual([
      pattern,
      '*.jsx',
      '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,md,mdx,jsx}',
    ]);
    expect(result[pattern]).toBe(first);
    expect(Object.values(result).at(-1)).toEqual({
      condition: { not: 'foreign' },
      loaders: ['/gt-next/loader.js'],
    });
    expect(result['*.jsx']).toBe(later);
    expect(Object.keys(rules)).toEqual([pattern, '*.jsx']);
    expect(rules[pattern]).toBe(first);
  });
});
