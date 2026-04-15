import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { collectionPass } from '../collectionPass';
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
    { devHotReloadEnabled: true, ...overrides },
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
      const { runtimeCalls } = transform(`
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { T } from 'gt-react';
        const el = _jsx(T, { children: "Hello" });
      `);

      const jsxCalls = runtimeCalls.filter((c) =>
        t.isIdentifier(c.callee, {
          name: GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx,
        })
      );
      expect(jsxCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('passes $context and $id for JSX', () => {
      const { runtimeCalls } = transform(`
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { T } from 'gt-react';
        const el = _jsx(T, { context: "nav", id: "greeting", children: "Hello" });
      `);

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
  });

  // ===== Combined tests =====

  describe('combined', () => {
    it('batches strings and JSX into a single Promise.all', () => {
      const { code, runtimeCalls } = transform(`
        import { jsx as _jsx } from 'react/jsx-runtime';
        import { useGT, T } from 'gt-react';
        const t = useGT();
        const msg = t("Hello");
        const el = _jsx(T, { children: "World" });
      `);

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

    it('respects devHotReloadEnabled from gtConfig', () => {
      const state = initializeState(
        {
          gtConfig: {
            files: {
              gt: {
                parsingFlags: {
                  devHotReloadEnabled: true,
                },
              },
            },
          },
        },
        'test.tsx'
      );
      expect(state.settings.devHotReloadEnabled).toBe(true);
    });

    it('direct option overrides gtConfig', () => {
      const state = initializeState(
        {
          devHotReloadEnabled: true,
          gtConfig: {
            files: {
              gt: {
                parsingFlags: {
                  devHotReloadEnabled: false,
                },
              },
            },
          },
        },
        'test.tsx'
      );
      expect(state.settings.devHotReloadEnabled).toBe(true);
    });
  });
});
