import { ParseResult } from '@babel/parser';
import * as t from '@babel/types';

/**
 * Given the vite config file ast, inserts the import declaration for the @generaltranslation/compiler package
 */
export function addCompilerImport({
  ast,
  cjsEnabled,
}: {
  ast: ParseResult<t.File>;
  cjsEnabled: boolean;
}) {
  if (cjsEnabled) {
    handleCjsImport(ast);
  } else {
    handleEsmImport(ast);
  }
}

/**
 * Adds a CJS import declaration for the @generaltranslation/compiler package
 * @param ast - The ast of the file
 * const gtCompiler = require('@generaltranslation/compiler').vite;
 */
function handleCjsImport(ast: ParseResult<t.File>) {
  const variableDeclaration = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier('gtCompiler'),
      t.memberExpression(
        t.callExpression(t.identifier('require'), [
          t.stringLiteral('@generaltranslation/compiler'),
        ]),
        t.identifier('vite')
      )
    ),
  ]);
  ast.program.body.unshift(variableDeclaration);
}

/**
 * Adds an ESM import declaration for the @generaltranslation/compiler package
 * @param ast - The ast of the file
 * import { vite as gtCompiler } from '@generaltranslation/compiler';
 */
function handleEsmImport(ast: ParseResult<t.File>) {
  const importDeclaration = t.importDeclaration(
    [t.importSpecifier(t.identifier('gtCompiler'), t.identifier('vite'))],
    t.stringLiteral('@generaltranslation/compiler')
  );
  ast.program.body.unshift(importDeclaration);
}
