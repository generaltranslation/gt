import {
  moduleExportName,
  patternBindings,
  staticString,
  walk,
  type ESTree,
} from './ast.js';
import { requireSpecifier } from './evaluate.js';

/** The specifiers of every module a program loads values from. */
export function loadedSpecifiers(program: ESTree.Program): Set<string> {
  const specifiers = new Set<string>();

  const add = (specifier: string | undefined) => {
    if (specifier !== undefined) specifiers.add(specifier);
  };

  walk(program, {
    enter(node) {
      switch (node.type) {
        case 'ImportDeclaration':
          if (node.importKind !== 'type') add(node.source.value);
          return false;

        case 'ExportAllDeclaration':
          if (node.exportKind !== 'type') add(node.source.value);
          return false;

        case 'ExportNamedDeclaration':
          if (node.exportKind !== 'type') add(node.source?.value);
          return true;

        case 'TSImportEqualsDeclaration':
          add(importEqualsSpecifier(node));
          return false;

        case 'ImportExpression':
          add(staticString(node.source));
          return true;

        case 'CallExpression':
          add(requireSpecifier(node));
          return true;

        default:
          return true;
      }
    },
  });

  return specifiers;
}

/** `import a = require("./a")` */
function importEqualsSpecifier(
  node: ESTree.TSImportEqualsDeclaration
): string | undefined {
  const reference = node.moduleReference;
  if (
    node.importKind === 'type' ||
    reference.type !== 'TSExternalModuleReference'
  ) {
    return undefined;
  }

  return reference.expression.value;
}

export function valueImports(
  program: ESTree.Program
): ESTree.ImportDeclaration[] {
  return program.body.filter(
    (statement): statement is ESTree.ImportDeclaration =>
      statement.type === 'ImportDeclaration' && statement.importKind !== 'type'
  );
}

export function importedName(
  specifier: ESTree.ImportSpecifier | ESTree.ImportDefaultSpecifier
): string {
  if (specifier.type === 'ImportDefaultSpecifier') return 'default';

  return moduleExportName(specifier.imported);
}

/** Where a module imports the name `local` from; undefined for a namespace import. */
export function importOf(
  program: ESTree.Program,
  local: string
): { source: string; name: string } | undefined {
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue;

    for (const specifier of statement.specifiers) {
      if (
        specifier.local.name !== local ||
        specifier.type === 'ImportNamespaceSpecifier'
      )
        continue;

      return { source: statement.source.value, name: importedName(specifier) };
    }
  }

  return undefined;
}

export function hasEsmExports(program: ESTree.Program): boolean {
  return program.body.some(
    (statement) =>
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration' ||
      statement.type === 'ExportAllDeclaration'
  );
}

/** Declared or exported at the top level of a module. */
export function topLevelClasses(program: ESTree.Program): ESTree.Class[] {
  const classes: ESTree.Class[] = [];

  for (const statement of program.body) {
    const isExport =
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration';
    const declaration = isExport ? statement.declaration : statement;

    if (
      declaration?.type === 'ClassDeclaration' ||
      declaration?.type === 'ClassExpression'
    ) {
      classes.push(declaration);
    }
  }

  return classes;
}

export function declaredNames(declaration: ESTree.Declaration): string[] {
  switch (declaration.type) {
    case 'VariableDeclaration':
      return declaration.declarations.flatMap((declarator) =>
        patternBindings(declarator.id).map(({ name }) => name)
      );

    case 'FunctionDeclaration':
    case 'ClassDeclaration':
    case 'TSEnumDeclaration':
      return declaration.id ? [declaration.id.name] : [];

    default:
      return [];
  }
}
