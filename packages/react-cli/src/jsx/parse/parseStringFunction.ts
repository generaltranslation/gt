import { NodePath } from '@babel/traverse';
import {
  ImportDeclaration,
  VariableDeclarator,
  VariableDeclaration,
} from '@babel/types';
import { Updates } from '../../types';
import { splitStringToContent } from 'generaltranslation';
import * as t from '@babel/types';
import { isStaticExpression } from '../evaluateJsx';

export function parseStrings(
  path: NodePath<ImportDeclaration | VariableDeclaration>,
  updates: Updates,
  errors: string[],
  file: string,
  pkg: 'gt-react' | 'gt-next'
): void {
  const translationFuncs = ['useGT', 'getGT']; // placeholder for now

  if (path.node.type === 'ImportDeclaration') {
    // Handle ES6 imports
    if (path.node.source.value === pkg) {
      path.node.specifiers.forEach((specifier) => {
        if (
          specifier.type === 'ImportSpecifier' &&
          'name' in specifier.imported &&
          translationFuncs.includes(specifier.imported.name)
        ) {
          handleTranslationFunction(specifier.local.name, path, updates);
        }
      });
    }
  } else if (path.node.type === 'VariableDeclaration') {
    // Handle CJS requires
    path.node.declarations.forEach((declaration) => {
      if (
        declaration.init?.type === 'CallExpression' &&
        declaration.init.callee.type === 'Identifier' &&
        declaration.init.callee.name === 'require' &&
        declaration.init.arguments[0]?.type === 'StringLiteral' &&
        declaration.init.arguments[0].value === pkg &&
        declaration.id.type === 'ObjectPattern'
      ) {
        declaration.id.properties.forEach((prop) => {
          if (
            prop.type === 'ObjectProperty' &&
            prop.key.type === 'Identifier' &&
            translationFuncs.includes(prop.key.name) &&
            prop.value.type === 'Identifier'
          ) {
            handleTranslationFunction(prop.value.name, path, updates);
          }
        });
      }
    });
  }
}

function handleTranslationFunction(
  importName: string,
  path: NodePath,
  updates: Updates
): void {
  path.scope.bindings[importName]?.referencePaths.forEach((refPath) => {
    const varDecl = refPath.findParent((p) =>
      p.isVariableDeclarator()
    ) as NodePath<VariableDeclarator>;
    if (varDecl && varDecl.node.id.type === 'Identifier') {
      const tFuncName = varDecl.node.id.name;
      path.scope.bindings[tFuncName]?.referencePaths.forEach((tPath) => {
        if (
          tPath.parent.type === 'CallExpression' &&
          tPath.parent.arguments.length > 0
        ) {
          const arg = tPath.parent.arguments[0];
          if (arg.type === 'StringLiteral') {
            const source = arg.value;
            const content = splitStringToContent(source);
            const options = tPath.parent.arguments[1];

            let metadata: Record<string, string> = {};

            // Only process options if they exist
            if (options && options.type === 'ObjectExpression') {
              options.properties.forEach((prop) => {
                if (
                  prop.type === 'ObjectProperty' &&
                  prop.key.type === 'Identifier'
                ) {
                  // Check for id property
                  if (prop.key.name === 'id' && t.isExpression(prop.value)) {
                    const idResult = isStaticExpression(prop.value);
                    if (idResult.isStatic && idResult.value) {
                      metadata.id = idResult.value;
                    }
                  }
                  // Check for context property
                  if (
                    prop.key.name === 'context' &&
                    t.isExpression(prop.value)
                  ) {
                    const contextResult = isStaticExpression(prop.value);
                    if (contextResult.isStatic && contextResult.value) {
                      metadata.context = contextResult.value;
                    }
                  }
                }
              });
            }

            updates.push({
              type: 'content',
              source: content,
              metadata,
            });
          }
        }
      });
    }
  });
}
