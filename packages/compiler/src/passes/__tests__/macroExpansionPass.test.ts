import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { macroExpansionPass } from '../macroExpansionPass';
import { initializeState } from '../../state/utils/initializeState';

// --- Helpers ---

interface TransformResult {
  ast: t.File;
  tCalls: t.CallExpression[];
  imports: t.ImportDeclaration[];
}

function transform(
  code: string,
  overrides: Record<string, unknown> = {}
): TransformResult {
  const state = initializeState({}, 'test.tsx');
  Object.assign(state.settings, overrides);
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, macroExpansionPass(state));

  const tCalls: t.CallExpression[] = [];
  const imports: t.ImportDeclaration[] = [];
  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: 't' })) {
        tCalls.push(path.node);
      }
    },
    ImportDeclaration(path) {
      imports.push(path.node);
    },
  });

  return { ast, tCalls, imports };
}

/** Get the first argument of a t() call as a string value (StringLiteral only) */
function getMessageString(call: t.CallExpression): string {
  const arg = call.arguments[0];
  expect(t.isStringLiteral(arg)).toBe(true);
  return (arg as t.StringLiteral).value;
}

/** Get the first argument of a t() call as a TemplateLiteral */
function getMessageTemplate(call: t.CallExpression): t.TemplateLiteral {
  const arg = call.arguments[0];
  expect(t.isTemplateLiteral(arg)).toBe(true);
  return arg as t.TemplateLiteral;
}

/** Get variable keys from t()'s second ObjectExpression arg */
function getVarKeys(call: t.CallExpression): string[] {
  const arg = call.arguments[1];
  if (!arg || !t.isObjectExpression(arg)) return [];
  return arg.properties
    .filter((p): p is t.ObjectProperty => t.isObjectProperty(p))
    .map((p) => (p.key as t.StringLiteral).value);
}

/** Get variable values (as identifier names) from t()'s second arg */
function getVarIdentifiers(call: t.CallExpression): string[] {
  const arg = call.arguments[1];
  if (!arg || !t.isObjectExpression(arg)) return [];
  return arg.properties
    .filter((p): p is t.ObjectProperty => t.isObjectProperty(p))
    .map((p) => (p.value as t.Identifier).name);
}

/** Check whether a TemplateLiteral contains a derive() call expression */
function findDeriveExpressions(tl: t.TemplateLiteral): t.CallExpression[] {
  return tl.expressions.filter(
    (e): e is t.CallExpression =>
      t.isCallExpression(e) && t.isIdentifier(e.callee, { name: 'derive' })
  );
}

/** Check that no transformation occurred (tagged template is still present) */
function assertStillTaggedTemplate(ast: t.File): void {
  let found = false;
  traverse(ast, {
    TaggedTemplateExpression(path) {
      if (t.isIdentifier(path.node.tag, { name: 't' })) {
        found = true;
        path.stop();
      }
    },
  });
  expect(found).toBe(true);
}

// --- Tests ---

describe('macroExpansionPass', () => {
  // --- Basic transformation ---

  it('transforms tagged template: t`Hello, ${name}`', () => {
    const { tCalls } = transform('const x = t`Hello, ${name}`;');
    expect(tCalls).toHaveLength(1);
    expect(getMessageString(tCalls[0])).toBe('Hello, {0}');
    expect(getVarKeys(tCalls[0])).toEqual(['0']);
    expect(getVarIdentifiers(tCalls[0])).toEqual(['name']);
  });

  it('leaves plain string call t("Hello") untouched', () => {
    const { tCalls } = transform('const x = t("Hello");');
    expect(tCalls).toHaveLength(1);
    expect(getMessageString(tCalls[0])).toBe('Hello');
    expect(tCalls[0].arguments).toHaveLength(1);
  });

  it('transforms custom stringTranslationMacro: __`hello`', () => {
    const { tCalls } = transform('const x = __`hello ${name}`;', {
      stringTranslationMacro: '__',
    });
    expect(tCalls).toHaveLength(1);
    expect(getMessageString(tCalls[0])).toBe('hello {0}');
    expect(t.isIdentifier(tCalls[0].callee, { name: 't' })).toBe(true);
  });

  // --- Auto-import ---

  it('adds auto-import when macros are expanded', () => {
    const { imports } = transform('const x = t`hello`;');
    const gtImport = imports.find((i) => i.source.value === 'gt-react/browser');
    expect(gtImport).toBeDefined();
  });

  it('adds auto-import when the existing browser t import is aliased', () => {
    const { imports } = transform(
      "import { t as browserT } from 'gt-react/browser';\nconst x = t`hello`;"
    );
    const localTImports = imports.filter(
      (i) =>
        i.source.value === 'gt-react/browser' &&
        i.specifiers.some((s) => t.isImportSpecifier(s) && s.local.name === 't')
    );
    expect(localTImports).toHaveLength(1);
  });

  it('does NOT add auto-import when no macros are found', () => {
    const { imports } = transform('const x = t("hello");');
    const gtImport = imports.find((i) => i.source.value === 'gt-react/browser');
    expect(gtImport).toBeUndefined();
  });

  it('handles multiple macros in one file with a single import', () => {
    const { tCalls, imports } = transform(
      'const a = t`hello ${name}`;\nconst b = t`goodbye ${name}`;'
    );
    const gtImports = imports.filter(
      (i) => i.source.value === 'gt-react/browser'
    );
    expect(gtImports).toHaveLength(1);
    expect(tCalls).toHaveLength(2);
    expect(getMessageString(tCalls[0])).toBe('hello {0}');
    expect(getMessageString(tCalls[1])).toBe('goodbye {0}');
  });

  it('does NOT transform tagged template t imported from gt-react/browser', () => {
    const { ast, imports } = transform(
      "import { t } from 'gt-react/browser';\nconst x = t`hello ${name}`;"
    );
    const gtImports = imports.filter(
      (i) => i.source.value === 'gt-react/browser'
    );
    expect(gtImports).toHaveLength(1);
    assertStillTaggedTemplate(ast);
  });

  // --- Scope guarding ---

  it('does NOT transform tagged template t imported from a non-browser GT source', () => {
    const { ast } = transform(
      "import { t } from 'gt-next';\nconst x = t`hello ${name}`;"
    );
    assertStillTaggedTemplate(ast);
  });

  it('does NOT transform tagged template t imported from a non-GT source', () => {
    const { ast } = transform(
      "import { t } from 'i18next';\nconst x = t`hello ${name}`;"
    );
    assertStillTaggedTemplate(ast);
  });

  it('does NOT transform tagged template when t is a local variable', () => {
    const { ast } = transform(
      'const t = (s) => s;\nconst x = t`hello ${name}`;'
    );
    assertStillTaggedTemplate(ast);
  });

  it('does NOT transform tagged template when t is destructured from a non-GT call', () => {
    const { ast } = transform(
      'const { t } = useTranslation();\nconst x = t`hello ${name}`;'
    );
    assertStillTaggedTemplate(ast);
  });

  // --- Derive preservation ---

  it('multiple derives in tagged template', () => {
    const code =
      "import { derive } from 'gt-react/browser';\nconst x = t`${derive(a)} and ${derive(b)}`;";
    const { tCalls } = transform(code);
    expect(tCalls).toHaveLength(1);
    const tl = getMessageTemplate(tCalls[0]);
    const derives = findDeriveExpressions(tl);
    expect(derives).toHaveLength(2);
    expect(tl.quasis[0].value.cooked).toBe('');
    expect(tl.quasis[1].value.cooked).toBe(' and ');
    expect(tl.quasis[2].value.cooked).toBe('');
    expect(tCalls[0].arguments).toHaveLength(1); // no variables
  });

  it('derive mixed with dynamic in tagged template', () => {
    const code =
      "import { derive } from 'gt-react/browser';\nconst x = t`${name} says ${derive(greeting)}`;";
    const { tCalls } = transform(code);
    expect(tCalls).toHaveLength(1);
    const tl = getMessageTemplate(tCalls[0]);
    const derives = findDeriveExpressions(tl);
    expect(derives).toHaveLength(1);
    expect(tl.quasis[0].value.cooked).toBe('{0} says ');
    expect(tl.quasis[1].value.cooked).toBe('');
    expect(getVarKeys(tCalls[0])).toEqual(['0']);
    expect(getVarIdentifiers(tCalls[0])).toEqual(['name']);
  });

  it('three derives with text between each', () => {
    const code =
      "import { derive } from 'gt-react/browser';\nconst x = t`X${derive(a)}Y${derive(b)}Z${derive(c)}W`;";
    const { tCalls } = transform(code);
    expect(tCalls).toHaveLength(1);
    const tl = getMessageTemplate(tCalls[0]);
    const derives = findDeriveExpressions(tl);
    expect(derives).toHaveLength(3);
    expect(tl.quasis.map((q) => q.value.cooked)).toEqual(['X', 'Y', 'Z', 'W']);
    expect(tCalls[0].arguments).toHaveLength(1);
  });

  it('derive only in tagged template', () => {
    const code =
      "import { derive } from 'gt-react/browser';\nconst x = t`${derive(x)}`;";
    const { tCalls } = transform(code);
    expect(tCalls).toHaveLength(1);
    const tl = getMessageTemplate(tCalls[0]);
    const derives = findDeriveExpressions(tl);
    expect(derives).toHaveLength(1);
    expect(tl.quasis[0].value.cooked).toBe('');
    expect(tl.quasis[1].value.cooked).toBe('');
    expect(tCalls[0].arguments).toHaveLength(1);
  });
});
