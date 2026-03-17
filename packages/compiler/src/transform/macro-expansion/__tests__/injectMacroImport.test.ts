import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { injectMacroImport } from '../injectMacroImport';
import { GT_IMPORT_SOURCES } from '../../../utils/constants/gt/constants';

function parseAndGetProgramPath(code: string) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  let programPath: any;
  traverse(ast, {
    Program(path) {
      programPath = path;
      path.stop();
    },
  });
  return { ast, programPath };
}

describe('injectMacroImport', () => {
  it('adds import { t } from gt-react/browser', () => {
    const { programPath } = parseAndGetProgramPath('const x = 1;');
    injectMacroImport(programPath);
    const firstStmt = programPath.node.body[0];
    expect(t.isImportDeclaration(firstStmt)).toBe(true);
    expect((firstStmt as t.ImportDeclaration).source.value).toBe(
      GT_IMPORT_SOURCES.GT_REACT_BROWSER
    );
    const specifier = (firstStmt as t.ImportDeclaration).specifiers[0];
    expect(t.isImportSpecifier(specifier)).toBe(true);
    expect((specifier as t.ImportSpecifier).local.name).toBe('t');
  });

  it('adds import as the first statement in the program body', () => {
    const { programPath } = parseAndGetProgramPath(
      "import React from 'react';\nconst x = 1;"
    );
    injectMacroImport(programPath);
    const firstStmt = programPath.node.body[0];
    expect(t.isImportDeclaration(firstStmt)).toBe(true);
    expect((firstStmt as t.ImportDeclaration).source.value).toBe(
      GT_IMPORT_SOURCES.GT_REACT_BROWSER
    );
  });
});
