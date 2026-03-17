import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { macroExpansionPass } from '../macroExpansionPass';
import { initializeState } from '../../state/utils/initializeState';

function transform(code: string, overrides: Record<string, any> = {}): string {
  const state = initializeState({}, 'test.tsx');
  Object.assign(state.settings, overrides);
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, macroExpansionPass(state));
  return generate(ast, { retainLines: true, compact: false }).code;
}

describe('macroExpansionPass', () => {
  it('transforms tagged template: t`Hello, ${name}`', () => {
    const result = transform('const x = t`Hello, ${name}`;');
    expect(result).toContain('t("Hello, {0}"');
    expect(result).toContain('"0": name');
  });

  it('transforms template literal in call: t(`Hello, ${name}`)', () => {
    const result = transform('const x = t(`Hello, ${name}`);');
    expect(result).toContain('t("Hello, {0}"');
    expect(result).toContain('"0": name');
  });

  it('transforms concatenation in call: t("Hello, " + name)', () => {
    const result = transform('const x = t("Hello, " + name);');
    expect(result).toContain('t("Hello, {0}"');
    expect(result).toContain('"0": name');
  });

  it('leaves plain string call t("Hello") untouched', () => {
    const code = 'const x = t("Hello");';
    const result = transform(code);
    expect(result).toContain('t("Hello")');
    expect(result).not.toContain('"0"');
  });

  it('transforms custom stringTranslationMacro: __`hello`', () => {
    const result = transform('const x = __`hello ${name}`;', {
      stringTranslationMacro: '__',
    });
    // Output callee should be 't' (enum value), not '__'
    expect(result).toContain('t("hello {0}"');
  });

  it('does nothing when enableTaggedTemplate is false', () => {
    const code = 'const x = t`Hello, ${name}`;';
    const result = transform(code, { enableTaggedTemplate: false });
    expect(result).toContain('t`Hello, ${name}`');
  });

  it('enableTemplateLiteralArg: false skips template literal args', () => {
    const code = 'const x = t(`Hello, ${name}`);';
    const result = transform(code, { enableTemplateLiteralArg: false });
    expect(result).toContain('t(`Hello, ${name}`)');
  });

  it('enableConcatenationArg: false skips concatenation args', () => {
    const code = 'const x = t("Hello, " + name);';
    const result = transform(code, { enableConcatenationArg: false });
    expect(result).toContain('t("Hello, " + name)');
  });

  it('adds auto-import when macros are expanded', () => {
    const result = transform('const x = t`hello`;');
    expect(result).toContain('from "gt-react/browser"');
  });

  it('does NOT add auto-import when no macros are found', () => {
    const result = transform('const x = t("hello");');
    expect(result).not.toContain('gt-react/browser');
  });

  it('handles multiple macros in one file with a single import', () => {
    const code = `
const a = t\`hello \${name}\`;
const b = t\`goodbye \${name}\`;
`;
    const result = transform(code);
    const importMatches = result.match(/from "gt-react\/browser"/g);
    expect(importMatches).toHaveLength(1);
    expect(result).toContain('t("hello {0}"');
    expect(result).toContain('t("goodbye {0}"');
  });

  it('does NOT add import when t is already imported from gt-react/browser', () => {
    const code = `import { t } from 'gt-react/browser';\nconst x = t\`hello \${name}\`;`;
    const result = transform(code);
    expect(result).toContain('t("hello {0}"');
    const importMatches = result.match(/gt-react\/browser/g);
    expect(importMatches).toHaveLength(1);
  });

  it('does NOT add import when t is already imported from any GT source', () => {
    const code = `import { t } from 'gt-next';\nconst x = t\`hello \${name}\`;`;
    const result = transform(code);
    expect(result).toContain('t("hello {0}"');
    expect(result).not.toContain('gt-react/browser');
  });

  it('does NOT add import when enableMacroImportInjection is false', () => {
    const result = transform('const x = t`hello`;', {
      enableMacroImportInjection: false,
    });
    expect(result).toContain('t("hello")');
    expect(result).not.toContain('gt-react/browser');
  });
});
