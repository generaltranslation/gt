import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
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

const STRING_FN = 'GtInternalRuntimeTranslateString';
const JSX_FN = 'GtInternalRuntimeTranslateJsx';

const USE_GT = `import { useGT } from 'gt-react';\nconst gt = useGT();\n`;

const icuHash = (source: string) => hashSource({ source, dataFormat: 'ICU' });

/**
 * Runs collection + runtime translate (dev hot reload on by default) and
 * returns the injected runtime translate calls as [callee, ...args] values.
 */
function transform(
  code: string,
  options: Record<string, unknown> = {},
  passes: PassName[] = ['collection', 'runtimeTranslate']
) {
  const { ast, code: output } = runPasses(code, passes, {
    devHotReload: true,
    ...options,
  });
  const runtimeCalls = [
    ...findCalls(ast, STRING_FN),
    ...findCalls(ast, JSX_FN),
  ].map((call) => [
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
  describe('strings', () => {
    it('injects a runtime translate call with the message and its hash', () => {
      const { runtimeCalls, promiseAllCount } = transform(
        `${USE_GT}const msg = gt("Hello world");`
      );
      expect(runtimeCalls).toEqual([
        [STRING_FN, 'Hello world', { $_hash: icuHash('Hello world') }],
      ]);
      expect(promiseAllCount).toBe(1);
    });

    it('batches multiple strings into a single Promise.all', () => {
      const { runtimeCalls, promiseAllCount } = transform(`${USE_GT}
        const a = gt("Hello");
        const b = gt("Goodbye");
        const c = gt("Submit");
      `);
      expect(runtimeCalls.map(([, message]) => message)).toEqual([
        'Hello',
        'Goodbye',
        'Submit',
      ]);
      expect(promiseAllCount).toBe(1);
    });

    it.each([
      ['a useGT() callback', USE_GT, 'gt'],
      ['t()', `import { t } from 'gt-react';\n`, 't'],
      ['msg()', `import { msg } from 'gt-react';\n`, 'msg'],
    ])('passes the options of %s through', (_name, setup, fn) => {
      const { runtimeCalls } = transform(
        `${setup}${fn}("Hello", { $context: "nav", $id: "greet", $maxChars: 50, $format: "STRING" });`
      );
      expect(runtimeCalls).toEqual([
        [
          STRING_FN,
          'Hello',
          {
            $context: 'nav',
            $id: 'greet',
            $maxChars: 50,
            $format: 'STRING',
            $_hash: hashSource({
              source: 'Hello',
              context: 'nav',
              maxChars: 50,
              dataFormat: 'STRING',
            }),
          },
        ],
      ]);
    });

    it.each([
      [
        'a useGT() callback',
        `import { useGT, derive } from 'gt-react';\nconst gt = useGT();\ngt(derive(getName()));`,
      ],
      ['t()', `import { t, derive } from 'gt-react';\nt(derive(getName()));`],
    ])('skips derive content in %s', (_name, code) => {
      const { runtimeCalls } = transform(code, {
        autoderive: { jsx: false, strings: true },
      });
      expect(runtimeCalls).toEqual([]);
    });

    it('ignores t() imported from a non-GT source', () => {
      const { runtimeCalls } = transform(
        `import { t } from 'i18next';\nt("Hello");`
      );
      expect(runtimeCalls).toEqual([]);
    });

    it('translates a tagged template after macro expansion', () => {
      const { runtimeCalls } = transform(
        "import { t } from 'gt-react';\nconst x = t`Hello ${name}`;",
        {},
        ['macroExpansion', 'collection', 'runtimeTranslate']
      );
      expect(runtimeCalls).toEqual([
        [STRING_FN, 'Hello {0}', { $_hash: icuHash('Hello {0}') }],
      ]);
    });

    // Standalone t() / msg() must not disrupt the useGT callback counter
    it.each(['t', 'msg'])(
      'collects %s() alongside a useGT() callback',
      (fn) => {
        const { runtimeCalls } = transform(`
          import { useGT, ${fn} } from 'gt-react';
          const gt = useGT();
          gt("Callback string");
          ${fn}("Standalone string");
        `);
        expect(runtimeCalls.map(([, message]) => message).sort()).toEqual([
          'Callback string',
          'Standalone string',
        ]);
      }
    );

    it('does nothing when the file has no GT usage', () => {
      const { ast, runtimeCalls } = transform(`const x = 1 + 2;`);
      expect(runtimeCalls).toEqual([]);
      expect(ast.program.body.some((node) => t.isImportDeclaration(node))).toBe(
        false
      );
    });
  });

  describe('jsx', () => {
    const T_CODE = `
      import { jsx as _jsx } from 'react/jsx-runtime';
      import { useGT, T } from 'gt-react';
      const gt = useGT();
      const msg = gt("Hello");
      const el = _jsx(T, { context: "nav", id: "greeting", children: "World" });
    `;

    it('injects a JSX runtime translate call with the <T> context and id', () => {
      const { runtimeCalls } = transform(T_CODE, {
        devHotReload: { jsx: true },
      });
      expect(runtimeCalls).toEqual([
        [JSX_FN, 'World', { $context: 'nav', $id: 'greeting' }],
      ]);
    });

    it('injects a JSX runtime translate call without options for a plain <T>', () => {
      const { runtimeCalls } = transform(
        `
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { T } from 'gt-react';
        const el = _jsx(T, { children: "Hello" });
      `,
        { devHotReload: { jsx: true } }
      );
      expect(runtimeCalls).toEqual([[JSX_FN, 'Hello', {}]]);
    });

    it('batches strings and JSX into a single Promise.all', () => {
      const { runtimeCalls, promiseAllCount } = transform(T_CODE, {
        devHotReload: { strings: true, jsx: true },
      });
      expect(runtimeCalls.map(([callee]) => callee)).toEqual([
        STRING_FN,
        JSX_FN,
      ]);
      expect(promiseAllCount).toBe(1);
    });

    it('strings-only dev hot reload does not inject JSX calls', () => {
      const { runtimeCalls } = transform(T_CODE, {
        devHotReload: { strings: true },
      });
      expect(runtimeCalls.map(([callee]) => callee)).toEqual([STRING_FN]);
    });
  });

  describe('import handling', () => {
    const CODE = `${USE_GT}const msg = gt("Hello");`;

    it('imports the runtime function from gt-react', () => {
      expect(importedNames(transform(CODE).ast, 'gt-react')).toContain(
        STRING_FN
      );
    });

    it('does not duplicate an existing import of the runtime function', () => {
      const { ast } = transform(
        `import { GtInternalRuntimeTranslateString } from 'gt-react';\n${CODE}`
      );
      expect(
        importedNames(ast, 'gt-react').filter((name) => name === STRING_FN)
      ).toHaveLength(1);
    });
  });

  it('keeps hash injection working when run after the injection pass', () => {
    const { output, runtimeCalls } = transform(
      `${USE_GT}const msg = gt("Hello world");`,
      {},
      ['collection', 'injection', 'runtimeTranslate']
    );
    const hash = icuHash('Hello world');
    expect(runtimeCalls).toEqual([
      [STRING_FN, 'Hello world', { $_hash: hash }],
    ]);
    expect(output).toContain(
      `useGT([{ $_hash: "${hash}", message: "Hello world" }])`
    );
    expect(output).toContain(`gt("Hello world", { "$_hash": "${hash}" })`);
  });
});

describe('devHotReload config resolution', () => {
  it.each([
    [true, { strings: true, jsx: false }],
    [false, { strings: false, jsx: false }],
    [undefined, { strings: false, jsx: false }],
    [{}, { strings: false, jsx: false }],
    [{ strings: true }, { strings: true, jsx: false }],
    [{ jsx: true }, { strings: false, jsx: true }],
    [
      { strings: true, jsx: true },
      { strings: true, jsx: true },
    ],
  ])('resolveDevHotReload(%j) -> %j', (value, expected) => {
    expect(resolveDevHotReload(value)).toEqual(expected);
  });

  const gtConfigWith = (parsingFlags: Record<string, unknown>) => ({
    files: { gt: { parsingFlags } },
  });

  it('reads devHotReload from gtConfig parsingFlags, overridden by the direct option', () => {
    const gtConfig = gtConfigWith({ devHotReload: true });
    expect(
      initializeState({ gtConfig }, 'test.tsx').settings.devHotReload
    ).toEqual({ strings: true, jsx: false });
    expect(
      initializeState({ gtConfig, devHotReload: { jsx: true } }, 'test.tsx')
        .settings.devHotReload
    ).toEqual({ strings: false, jsx: true });
    expect(
      initializeState(
        {
          gtConfig: gtConfigWith({ devHotReload: false }),
          devHotReload: { strings: true },
        },
        'test.tsx'
      ).settings.devHotReload
    ).toEqual({ strings: true, jsx: false });
  });
});
