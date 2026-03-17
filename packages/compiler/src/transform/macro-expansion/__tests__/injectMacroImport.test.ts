import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { injectMacroImport } from '../injectMacroImport';
import { TransformState } from '../../../state/types';
import { initializeState } from '../../../state/utils/initializeState';
import { GT_IMPORT_SOURCES } from '../../../utils/constants/gt/constants';

function createState(overrides: Record<string, any> = {}): TransformState {
  const state = initializeState({}, 'test.tsx');
  Object.assign(state.settings, overrides);
  return state;
}

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
  it('adds import { t } from gt-react/browser when no GT import exists', () => {
    const { programPath } = parseAndGetProgramPath('const x = 1;');
    const state = createState();
    injectMacroImport(programPath, state);
    const firstStmt = programPath.node.body[0];
    expect(t.isImportDeclaration(firstStmt)).toBe(true);
    expect((firstStmt as t.ImportDeclaration).source.value).toBe(
      GT_IMPORT_SOURCES.GT_REACT_BROWSER
    );
  });

  it('does NOT add import when t is already imported from gt-react/browser', () => {
    const { programPath } = parseAndGetProgramPath(
      "import { t } from 'gt-react/browser';\nconst x = 1;"
    );
    const state = createState();
    const bodyLenBefore = programPath.node.body.length;
    injectMacroImport(programPath, state);
    expect(programPath.node.body.length).toBe(bodyLenBefore);
  });

  it('does NOT add import when t is already imported from any GT source', () => {
    const { programPath } = parseAndGetProgramPath(
      "import { t } from 'gt-next';\nconst x = 1;"
    );
    const state = createState();
    const bodyLenBefore = programPath.node.body.length;
    injectMacroImport(programPath, state);
    expect(programPath.node.body.length).toBe(bodyLenBefore);
  });

  it('does NOT add import when enableMacroImportInjection is false', () => {
    const { programPath } = parseAndGetProgramPath('const x = 1;');
    const state = createState({ enableMacroImportInjection: false });
    const bodyLenBefore = programPath.node.body.length;
    injectMacroImport(programPath, state);
    expect(programPath.node.body.length).toBe(bodyLenBefore);
  });

  it('adds import as the first statement in the program body', () => {
    const { programPath } = parseAndGetProgramPath(
      "import React from 'react';\nconst x = 1;"
    );
    const state = createState();
    injectMacroImport(programPath, state);
    const firstStmt = programPath.node.body[0];
    expect(t.isImportDeclaration(firstStmt)).toBe(true);
    expect((firstStmt as t.ImportDeclaration).source.value).toBe(
      GT_IMPORT_SOURCES.GT_REACT_BROWSER
    );
  });
});
