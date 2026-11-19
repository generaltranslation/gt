import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import type { JsxChildren } from '@generaltranslation/format';
import {
  runPasses,
  findCalls,
  importedNames,
  literalValue,
  type PassName,
} from './testHelpers';
import { initializeState } from '../../state/utils/initializeState';
import { resolveDevHotReload } from '../../config';
import hashSource from '../../utils/calculateHash';

const JSX_FN = 'GtInternalRuntimeTranslateJsx';

const jsxHash = (source: JsxChildren) =>
  hashSource({ source, dataFormat: 'JSX' });

const T_CODE = `
  import { jsx as _jsx } from 'react/jsx-runtime';
  import { T } from 'gt-react';
  const el = _jsx(T, { children: "Hello" });
`;

/**
 * Runs collection + runtime translate (JSX dev hot reload on by default) and
 * returns the injected runtime translate calls as [callee, ...args] values.
 */
function transform(
  code: string,
  options: Record<string, unknown> = {},
  passes: PassName[] = ['collection', 'runtimeTranslate']
) {
  const { ast, code: output } = runPasses(code, passes, {
    devHotReload: { jsx: true },
    ...options,
  });
  const runtimeCalls = findCalls(ast, JSX_FN).map((call) => [
    (call.callee as t.Identifier).name,
    ...call.arguments.map(literalValue),
  ]);
  return {
    ast,
    output,
    runtimeCalls,
    promiseAllCount: (output.match(/Promise\.all/g) ?? []).length,
  };
}

describe('runtimeTranslatePass', () => {
  it('injects a JSX runtime translate call with the <T> context and id', () => {
    const { runtimeCalls } = transform(`
      import { jsx as _jsx } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      const el = _jsx(T, { context: "nav", id: "greeting", children: "World" });
    `);
    expect(runtimeCalls).toEqual([
      [JSX_FN, 'World', { $context: 'nav', $id: 'greeting' }],
    ]);
  });

  it('injects a JSX runtime translate call without options for a plain <T>', () => {
    expect(transform(T_CODE).runtimeCalls).toEqual([[JSX_FN, 'Hello', {}]]);
  });

  it('batches multiple <T> into a single Promise.all', () => {
    const { runtimeCalls, promiseAllCount } = transform(
      `${T_CODE}const other = _jsx(T, { children: "Goodbye" });`
    );
    expect(runtimeCalls.map(([, children]) => children)).toEqual([
      'Hello',
      'Goodbye',
    ]);
    expect(promiseAllCount).toBe(1);
  });

  it('injects nothing for tagged templates', () => {
    const { runtimeCalls } = transform(
      "import { useGT } from 'gt-react';\nconst t = useGT();\nt`Hello`;"
    );
    expect(runtimeCalls).toEqual([]);
  });

  it('does nothing when the file has no GT usage', () => {
    const { ast, runtimeCalls } = transform(`const x = 1 + 2;`);
    expect(runtimeCalls).toEqual([]);
    expect(ast.program.body.some((node) => t.isImportDeclaration(node))).toBe(
      false
    );
  });

  describe('import handling', () => {
    it('imports the runtime function from gt-react', () => {
      expect(importedNames(transform(T_CODE).ast, 'gt-react')).toContain(
        JSX_FN
      );
    });

    it('does not duplicate an existing import of the runtime function', () => {
      const { ast } = transform(
        `import { GtInternalRuntimeTranslateJsx } from 'gt-react';\n${T_CODE}`
      );
      expect(
        importedNames(ast, 'gt-react').filter((name) => name === JSX_FN)
      ).toHaveLength(1);
    });
  });

  it('keeps hash injection working when run after the injection pass', () => {
    const { output, runtimeCalls } = transform(T_CODE, {}, [
      'collection',
      'injection',
      'runtimeTranslate',
    ]);
    expect(runtimeCalls).toEqual([[JSX_FN, 'Hello', {}]]);
    expect(output).toContain(`_hash: "${jsxHash('Hello')}"`);
  });
});

describe('devHotReload config resolution', () => {
  it.each([
    [undefined, { jsx: false }],
    [{}, { jsx: false }],
    [{ jsx: false }, { jsx: false }],
    [{ jsx: true }, { jsx: true }],
  ])('resolveDevHotReload(%j) -> %j', (value, expected) => {
    expect(resolveDevHotReload(value)).toEqual(expected);
  });

  const gtConfigWith = (parsingFlags: Record<string, unknown>) => ({
    files: { gt: { parsingFlags } },
  });

  it('reads devHotReload from gtConfig parsingFlags, overridden by the direct option', () => {
    const gtConfig = gtConfigWith({ devHotReload: { jsx: true } });
    expect(
      initializeState({ gtConfig }, 'test.tsx').settings.devHotReload
    ).toEqual({ jsx: true });
    expect(
      initializeState({ gtConfig, devHotReload: { jsx: false } }, 'test.tsx')
        .settings.devHotReload
    ).toEqual({ jsx: false });
    expect(
      initializeState(
        {
          gtConfig: gtConfigWith({ devHotReload: { jsx: false } }),
          devHotReload: { jsx: true },
        },
        'test.tsx'
      ).settings.devHotReload
    ).toEqual({ jsx: true });
  });
});
