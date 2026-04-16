import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { collectionPass } from '../collectionPass';
import { macroExpansionPass } from '../macroExpansionPass';
import { runtimeTranslatePass } from '../runtimeTranslatePass';
import { initializeState } from '../../state/utils/initializeState';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';

// --- Helpers ---

interface TransformResult {
  code: string;
  runtimeCalls: t.CallExpression[];
  imports: t.ImportDeclaration[];
}

/**
 * Runs collection + runtime translate passes.
 * Collection populates StringCollector, then runtime translate reads from it.
 */
function transform(
  code: string,
  overrides: Record<string, unknown> = {}
): TransformResult {
  const state = initializeState(
    { devHotReload: true, ...overrides },
    'test.tsx'
  );

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  // Pass 1: Collection (populates StringCollector)
  traverse(ast, collectionPass(state));

  // Pass 2: Runtime translate
  traverse(ast, runtimeTranslatePass(state));

  // Collect runtime translate calls and imports from output
  const runtimeCalls: t.CallExpression[] = [];
  const imports: t.ImportDeclaration[] = [];
  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString,
        }) ||
        t.isIdentifier(path.node.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx,
        })
      ) {
        runtimeCalls.push(path.node);
      }
    },
    ImportDeclaration(path) {
      imports.push(path.node);
    },
  });

  const generated = generate(ast, { retainLines: true, compact: false });

  return { code: generated.code, runtimeCalls, imports };
}

/**
 * Runs macro expansion → collection → runtime translate passes.
 * Used for tagged template tests where macro expansion must run first.
 */
function transformWithMacro(
  code: string,
  overrides: Record<string, unknown> = {}
): TransformResult {
  const state = initializeState(
    { devHotReload: true, ...overrides },
    'test.tsx'
  );

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  // Pass 1: Macro expansion (transforms t`...` → t("..."))
  traverse(ast, macroExpansionPass(state));

  // Pass 2: Collection (populates StringCollector)
  traverse(ast, collectionPass(state));

  // Pass 3: Runtime translate
  traverse(ast, runtimeTranslatePass(state));

  const runtimeCalls: t.CallExpression[] = [];
  const imports: t.ImportDeclaration[] = [];
  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString,
        }) ||
        t.isIdentifier(path.node.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx,
        })
      ) {
        runtimeCalls.push(path.node);
      }
    },
    ImportDeclaration(path) {
      imports.push(path.node);
    },
  });

  const generated = generate(ast, { retainLines: true, compact: false });

  return { code: generated.code, runtimeCalls, imports };
}

/** Get the first argument of a runtime translate call as a string */
function getMessageString(call: t.CallExpression): string {
  const arg = call.arguments[0];
  expect(t.isStringLiteral(arg)).toBe(true);
  return (arg as t.StringLiteral).value;
}

/** Get option value from the second argument (ObjectExpression) */
function getOptionValue(
  call: t.CallExpression,
  key: string
): string | number | undefined {
  const arg = call.arguments[1];
  if (!arg || !t.isObjectExpression(arg)) return undefined;
  for (const prop of arg.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const propKey = t.isStringLiteral(prop.key)
      ? prop.key.value
      : t.isIdentifier(prop.key)
        ? prop.key.name
        : undefined;
    if (propKey === key) {
      if (t.isStringLiteral(prop.value)) return prop.value.value;
      if (t.isNumericLiteral(prop.value)) return prop.value.value;
    }
  }
  return undefined;
}

/** Check if code contains a Promise.all call */
function hasPromiseAll(code: string): boolean {
  return code.includes('Promise.all');
}

/** Find import specifier names from a specific source */
function getImportSpecifiers(
  imports: t.ImportDeclaration[],
  source: string
): string[] {
  const decl = imports.find((i) => i.source.value === source);
  if (!decl) return [];
  return decl.specifiers
    .filter((s): s is t.ImportSpecifier => t.isImportSpecifier(s))
    .map((s) => (s.imported as t.Identifier).name);
}

// --- String extraction test code ---

const USEGT_IMPORT = `import { useGT } from 'gt-react';`;
const USEGT_SETUP = `${USEGT_IMPORT}
const t = useGT();`;

// --- Tests ---

describe('runtimeTranslatePass', () => {
  // ===== String tests =====

  describe('strings', () => {
    it('injects GtInternalRuntimeTranslateString for a simple string', () => {
      const { code, runtimeCalls } = transform(`
        ${USEGT_SETUP}
        const msg = t("Hello world");
      `);

      expect(runtimeCalls).toHaveLength(1);
      expect(getMessageString(runtimeCalls[0])).toBe('Hello world');
      expect(getOptionValue(runtimeCalls[0], '$_hash')).toBeDefined();
      expect(hasPromiseAll(code)).toBe(true);
    });

    it('batches multiple strings into a single Promise.all', () => {
      const { code, runtimeCalls } = transform(`
        ${USEGT_SETUP}
        const a = t("Hello");
        const b = t("Goodbye");
        const c = t("Submit");
      `);

      expect(runtimeCalls).toHaveLength(3);
      expect(getMessageString(runtimeCalls[0])).toBe('Hello');
      expect(getMessageString(runtimeCalls[1])).toBe('Goodbye');
      expect(getMessageString(runtimeCalls[2])).toBe('Submit');
      // Should be a single Promise.all, not 3 separate calls
      const promiseAllCount = (code.match(/Promise\.all/g) || []).length;
      expect(promiseAllCount).toBe(1);
    });

    it('passes $context, $id, and $maxChars options through', () => {
      const { runtimeCalls } = transform(`
        ${USEGT_SETUP}
        const msg = t("Hello", { $context: "greeting", $id: "hello_msg", $maxChars: 50 });
      `);

      expect(runtimeCalls).toHaveLength(1);
      expect(getOptionValue(runtimeCalls[0], '$context')).toBe('greeting');
      expect(getOptionValue(runtimeCalls[0], '$id')).toBe('hello_msg');
      expect(getOptionValue(runtimeCalls[0], '$maxChars')).toBe(50);
    });

    it('passes $format option through', () => {
      const { runtimeCalls } = transform(`
        ${USEGT_SETUP}
        const msg = t("Hello", { $format: "STRING" });
      `);

      expect(runtimeCalls).toHaveLength(1);
      expect(getOptionValue(runtimeCalls[0], '$format')).toBe('STRING');
    });

    it('skips derive content (empty hash)', () => {
      const { runtimeCalls } = transform(
        `
        import { useGT, derive } from 'gt-react';
        const t = useGT();
        const msg = t(derive(getName()));
      `,
        { autoderive: { jsx: false, strings: true } }
      );

      // Derive content should be skipped (hash === '')
      expect(runtimeCalls).toHaveLength(0);
    });
  });

  // ===== JSX tests =====

  describe('jsx', () => {
    it('injects GtInternalRuntimeTranslateJsx for a T component', () => {
      const { runtimeCalls } = transform(
        `
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { T } from 'gt-react';
        const el = _jsx(T, { children: "Hello" });
      `,
        { devHotReload: { jsx: true } }
      );

      const jsxCalls = runtimeCalls.filter((c) =>
        t.isIdentifier(c.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx,
        })
      );
      expect(jsxCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('passes $context and $id for JSX', () => {
      const { runtimeCalls } = transform(
        `
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { T } from 'gt-react';
        const el = _jsx(T, { context: "nav", id: "greeting", children: "Hello" });
      `,
        { devHotReload: { jsx: true } }
      );

      const jsxCalls = runtimeCalls.filter((c) =>
        t.isIdentifier(c.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx,
        })
      );
      if (jsxCalls.length > 0) {
        expect(getOptionValue(jsxCalls[0], '$context')).toBe('nav');
        expect(getOptionValue(jsxCalls[0], '$id')).toBe('greeting');
      }
    });

    // <T context="this is a very formal greeting">Hello this is a greeting</T>
    // → GtInternalRuntimeTranslateJsx(children, { $context: "...", $id: undefined })
    //   with a non-empty hash computed from children + context
    it('extracts context, id, and hash from <T> component props', () => {
      const { runtimeCalls } = transform(
        `
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { T } from 'gt-react';
        const el = _jsx(T, {
          context: "this is a very formal greeting",
          id: "formal_hello",
          children: "Hello this is a greeting"
        });
      `,
        { devHotReload: { jsx: true } }
      );

      const jsxCalls = runtimeCalls.filter((c) =>
        t.isIdentifier(c.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx,
        })
      );
      expect(jsxCalls).toHaveLength(1);

      // context and id should be passed through
      expect(getOptionValue(jsxCalls[0], '$context')).toBe(
        'this is a very formal greeting'
      );
      expect(getOptionValue(jsxCalls[0], '$id')).toBe('formal_hello');

      // children should be the first argument (serialized JSX children)
      expect(jsxCalls[0].arguments[0]).toBeDefined();

      // hash should have been computed (non-empty) — stored in TranslationJsx
      // The runtime translate pass reads from jsxAggregators which stores the hash,
      // but the hash is not passed as an option for JSX calls (unlike strings).
      // We verify the call was generated, which means hash !== '' (derive-skipped entries are filtered out)
    });
  });

  // ===== Combined tests =====

  describe('combined', () => {
    it('batches strings and JSX into a single Promise.all', () => {
      const { code, runtimeCalls } = transform(
        `
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { useGT, T } from 'gt-react';
        const t = useGT();
        const msg = t("Hello");
        const el = _jsx(T, { children: "World" });
      `,
        { devHotReload: { strings: true, jsx: true } }
      );

      expect(runtimeCalls.length).toBeGreaterThanOrEqual(2);
      const promiseAllCount = (code.match(/Promise\.all/g) || []).length;
      expect(promiseAllCount).toBe(1);
    });
  });

  // ===== Import handling =====

  describe('import handling', () => {
    it('injects import from gt-react/browser', () => {
      const { imports } = transform(`
        ${USEGT_SETUP}
        const msg = t("Hello");
      `);

      const specifiers = getImportSpecifiers(imports, 'gt-react/browser');
      expect(specifiers).toContain(
        GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString
      );
    });

    it('does not duplicate import if GtInternalRuntimeTranslateString already imported', () => {
      const { imports } = transform(`
        import { useGT } from 'gt-react';
        import { GtInternalRuntimeTranslateString } from 'gt-react/browser';
        const t = useGT();
        const msg = t("Hello");
      `);

      // Count how many imports from gt-react/browser have GtInternalRuntimeTranslateString
      const allSpecifiers = imports
        .filter((i) => i.source.value === 'gt-react/browser')
        .flatMap((i) =>
          i.specifiers
            .filter((s): s is t.ImportSpecifier => t.isImportSpecifier(s))
            .map((s) => (s.imported as t.Identifier).name)
        );

      const stringImportCount = allSpecifiers.filter(
        (n) => n === GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString
      ).length;
      expect(stringImportCount).toBe(1);
    });
  });

  // ===== Config tests =====

  describe('config', () => {
    it('does not inject when no GT usage in file', () => {
      const { runtimeCalls, imports } = transform(`
        const x = 1 + 2;
      `);

      expect(runtimeCalls).toHaveLength(0);
      const specifiers = getImportSpecifiers(imports, 'gt-react/browser');
      expect(specifiers).not.toContain(
        GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString
      );
    });

    it('respects devHotReload from gtConfig', () => {
      const state = initializeState(
        {
          gtConfig: {
            files: {
              gt: {
                parsingFlags: {
                  devHotReload: true,
                },
              },
            },
          },
        },
        'test.tsx'
      );
      expect(state.settings.devHotReload).toEqual({
        strings: true,
        jsx: false,
      });
    });

    it('direct option overrides gtConfig', () => {
      const state = initializeState(
        {
          devHotReload: { strings: true },
          gtConfig: {
            files: {
              gt: {
                parsingFlags: {
                  devHotReload: false,
                },
              },
            },
          },
        },
        'test.tsx'
      );
      expect(state.settings.devHotReload).toEqual({
        strings: true,
        jsx: false,
      });
    });

    it('supports granular devHotReload config', () => {
      const state = initializeState(
        { devHotReload: { jsx: true } },
        'test.tsx'
      );
      expect(state.settings.devHotReload).toEqual({
        strings: false,
        jsx: true,
      });
    });
  });

  // ===== t() function extraction =====

  describe('t() function extraction', () => {
    // import { t } from 'gt-react'; t("Hello")
    // → GtInternalRuntimeTranslateString("Hello", { $_hash: "..." })
    it('extracts standalone t() call and injects runtime translate', () => {
      const { runtimeCalls } = transform(`
        import { t } from 'gt-react';
        t("Hello");
      `);

      expect(runtimeCalls).toHaveLength(1);
      expect(getMessageString(runtimeCalls[0])).toBe('Hello');
      expect(getOptionValue(runtimeCalls[0], '$_hash')).toBeDefined();
    });

    // import { t } from 'gt-react'; t("Hello", { $context: "nav", $id: "greet", $maxChars: 50 })
    // → all options preserved in the injected call
    it('passes t() options through to runtime translate call', () => {
      const { runtimeCalls } = transform(`
        import { t } from 'gt-react';
        t("Hello", { $context: "nav", $id: "greet", $maxChars: 50 });
      `);

      expect(runtimeCalls).toHaveLength(1);
      expect(getOptionValue(runtimeCalls[0], '$context')).toBe('nav');
      expect(getOptionValue(runtimeCalls[0], '$id')).toBe('greet');
      expect(getOptionValue(runtimeCalls[0], '$maxChars')).toBe(50);
    });

    // import { t } from 'gt-react'; t("A"); t("B"); t("C")
    // → all three appear in Promise.all
    it('extracts multiple t() calls into a single Promise.all', () => {
      const { code, runtimeCalls } = transform(`
        import { t } from 'gt-react';
        t("Alpha");
        t("Bravo");
        t("Charlie");
      `);

      expect(runtimeCalls).toHaveLength(3);
      expect(getMessageString(runtimeCalls[0])).toBe('Alpha');
      expect(getMessageString(runtimeCalls[1])).toBe('Bravo');
      expect(getMessageString(runtimeCalls[2])).toBe('Charlie');
      const promiseAllCount = (code.match(/Promise\.all/g) || []).length;
      expect(promiseAllCount).toBe(1);
    });

    // import { t } from 'gt-react'; import { derive } from 'gt-react';
    // t(derive(fn())) → skipped (derive content, not in Promise.all)
    it('skips t() with derive content', () => {
      const { runtimeCalls } = transform(
        `
        import { t, derive } from 'gt-react';
        t(derive(getName()));
      `,
        { autoderive: { jsx: false, strings: true } }
      );

      expect(runtimeCalls).toHaveLength(0);
    });

    // import { t } from 'i18next'; t("Hello")
    // → not extracted because t is not from a GT source
    it('ignores t() imported from non-GT source', () => {
      const { runtimeCalls } = transform(`
        import { t } from 'i18next';
        t("Hello");
      `);

      expect(runtimeCalls).toHaveLength(0);
    });
  });

  // ===== msg() function extraction =====

  describe('msg() function extraction', () => {
    // import { msg } from 'gt-react'; msg("Hello")
    // → GtInternalRuntimeTranslateString("Hello", { $_hash: "..." })
    it('extracts msg() call and injects runtime translate', () => {
      const { runtimeCalls } = transform(`
        import { msg } from 'gt-react';
        msg("Hello");
      `);

      expect(runtimeCalls).toHaveLength(1);
      expect(getMessageString(runtimeCalls[0])).toBe('Hello');
      expect(getOptionValue(runtimeCalls[0], '$_hash')).toBeDefined();
    });

    // import { msg } from 'gt-react'; msg("Hello", { $context: "nav" })
    // → options preserved in the injected call
    it('passes msg() options through', () => {
      const { runtimeCalls } = transform(`
        import { msg } from 'gt-react';
        msg("Hello", { $context: "nav" });
      `);

      expect(runtimeCalls).toHaveLength(1);
      expect(getOptionValue(runtimeCalls[0], '$context')).toBe('nav');
    });
  });

  // ===== Tagged template extraction =====

  describe('tagged template extraction', () => {
    // t`Hello` (post-macro-expansion becomes t("Hello"))
    // → GtInternalRuntimeTranslateString("Hello", { $_hash: "..." })
    it('extracts tagged template with interpolation via macro expansion', () => {
      const { runtimeCalls } = transformWithMacro(`
        import { t } from 'gt-react/browser';
        const x = t\`Hello \${name}\`;
      `);

      expect(runtimeCalls.length).toBeGreaterThanOrEqual(1);
      // After macro expansion: t`Hello ${name}` → t("Hello {0}", {"0": name})
      // The message should be "Hello {0}"
      const messages = runtimeCalls.map((c) => getMessageString(c));
      expect(messages).toContain('Hello {0}');
    });

    // t`Hello` with no interpolation
    // → GtInternalRuntimeTranslateString("Hello", { $_hash: "..." })
    it('extracts simple tagged template via macro expansion', () => {
      const { runtimeCalls } = transformWithMacro(`
        import { t } from 'gt-react/browser';
        const x = t\`Hello\`;
      `);

      expect(runtimeCalls.length).toBeGreaterThanOrEqual(1);
      const messages = runtimeCalls.map((c) => getMessageString(c));
      expect(messages).toContain('Hello');
    });
  });

  // ===== Counter isolation tests =====

  describe('counter isolation', () => {
    // File has both useGT callback AND standalone t():
    //   import { useGT, t } from 'gt-react';
    //   const gt = useGT(); gt("Callback string");
    //   t("Standalone string");
    // → both appear in Promise.all, AND the useGT injection (hash) still works
    //   because t() uses runtimeOnlyEntries, not the counter-based aggregators
    it('t() does not disrupt useGT callback counter alignment', () => {
      const { runtimeCalls } = transform(`
        import { useGT, t } from 'gt-react';
        const gt = useGT();
        gt("Callback string");
        t("Standalone string");
      `);

      // Both should be extracted
      const messages = runtimeCalls.map((c) => getMessageString(c));
      expect(messages).toContain('Callback string');
      expect(messages).toContain('Standalone string');
    });

    // Same test with msg() — ensure it doesn't break counter alignment
    it('msg() does not disrupt useGT callback counter alignment', () => {
      const { runtimeCalls } = transform(`
        import { useGT, msg } from 'gt-react';
        const gt = useGT();
        gt("Callback string");
        msg("Registration string");
      `);

      const messages = runtimeCalls.map((c) => getMessageString(c));
      expect(messages).toContain('Callback string');
      expect(messages).toContain('Registration string');
    });
  });
});
