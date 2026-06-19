import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { getPathsAndAliases } from '../getPathsAndAliases.js';
import { Libraries } from '../../../../types/libraries.js';
import {
  T_GLOBAL_REGISTRATION_FUNCTION_MARKER,
  T_REGISTRATION_FUNCTION,
} from '../constants.js';

const pkgs = [Libraries.GT_REACT];

function parseCode(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

function getGlobalEntries(code: string) {
  const ast = parseCode(code);
  const { inlineTranslationPaths } = getPathsAndAliases(ast, pkgs);
  return inlineTranslationPaths.filter(
    (p) => p.originalName === T_GLOBAL_REGISTRATION_FUNCTION_MARKER
  );
}

function getInlineEntries(code: string) {
  const ast = parseCode(code);
  const { inlineTranslationPaths } = getPathsAndAliases(ast, pkgs);
  return inlineTranslationPaths.filter(
    (p) => p.originalName === T_REGISTRATION_FUNCTION
  );
}

describe('getPathsAndAliases - global t macro detection', () => {
  it('detects global t tagged template', () => {
    const entries = getGlobalEntries('const x = t`hello`;');
    expect(entries).toHaveLength(1);
  });

  it('detects global t tagged template with expressions', () => {
    const entries = getGlobalEntries('const x = t`hello ${name}`;');
    expect(entries).toHaveLength(1);
  });

  it('does NOT detect imported t as global', () => {
    const entries = getGlobalEntries(
      "import { t } from 'gt-react/browser';\nconst x = t`hello`;"
    );
    expect(entries).toHaveLength(0);
  });

  it('does NOT detect locally declared t as global', () => {
    const entries = getGlobalEntries(
      'const t = (s) => s;\nconst x = t`hello`;'
    );
    expect(entries).toHaveLength(0);
  });

  it('does NOT detect global t call expressions', () => {
    const entries = getGlobalEntries('const x = t("hello");');
    expect(entries).toHaveLength(0);
  });

  it('pushes one entry per usage for multiple global t macros', () => {
    const entries = getGlobalEntries(
      'const a = t`hello`;\nconst b = t`world`;'
    );
    expect(entries).toHaveLength(2);
  });
});

describe('getPathsAndAliases - gt-react entrypoints', () => {
  for (const source of ['gt-react', 'gt-react/browser', 'gt-react/client']) {
    it(`detects t imported from ${source}`, () => {
      const entries = getInlineEntries(
        `import { t } from '${source}';\nconst x = t\`hello\`;`
      );
      expect(entries).toHaveLength(1);
    });
  }
});
