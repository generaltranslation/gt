// Source-file reading and AST lookups shared by framework setups.
import traverseModule, { type Binding } from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'node:fs';
import path from 'node:path';
import { parseModule } from '../../setupViteSPA.js';

const traverse = traverseModule.default || traverseModule;

// Frameworks resolve entries by basename, so any of these may be the entry.
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

export type SourceFile = {
  /** Relative to the app, with forward slashes. */
  path: string;
  content: string;
  /** Undefined when the file cannot be parsed. */
  statements?: t.Statement[];
};

export async function readSourceFile(
  appDirectory: string,
  basename: string,
  { extensions = SOURCE_EXTENSIONS }: { extensions?: string[] } = {}
): Promise<SourceFile | undefined> {
  for (const extension of extensions) {
    const relativePath = `${basename}${extension}`;
    const absolutePath = path.join(appDirectory, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const content = await fs.promises.readFile(absolutePath, 'utf8');
    return {
      path: relativePath,
      content,
      statements: parseModule(content, relativePath),
    };
  }
  return undefined;
}

/**
 * The local name `name` is imported as from `source`. With `types`, type-only
 * imports count too.
 */
export function getLocalImport(
  file: SourceFile,
  name: string,
  source: string,
  { types = false }: { types?: boolean } = {}
): string | undefined {
  for (const statement of file.statements ?? []) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.source.value !== source ||
      (!types && statement.importKind === 'type')
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        (types || specifier.importKind !== 'type') &&
        t.isIdentifier(specifier.imported, { name })
      ) {
        return specifier.local.name;
      }
    }
  }
  return undefined;
}

/**
 * Whether code uses a name as an identifier: a binding, a reference, or a
 * property name such as `obj.name` or `{ name: 1 }`. Deliberately broad, since
 * a false match only sends setup to manual steps. Strings, comments, JSX
 * attributes and JSX element names are not identifiers, so they do not count.
 */
export function usesName(nodes: t.Node[], names: string[]): boolean {
  let used = false;
  for (const node of nodes) {
    t.traverseFast(node, (child) => {
      if (child.type === 'Identifier' && names.includes(child.name)) {
        used = true;
      }
    });
  }
  return used;
}

export type DeclaredFunction = {
  /** The statement that declares it, which may be an export. */
  statement: t.Statement;
  fn: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression;
};

/**
 * The `function name` or `const name = () => ...` a module declares, with the
 * statement declaring it. With `exported`, only an exported one counts.
 */
export function findDeclaredFunction(
  statements: t.Statement[],
  name: string,
  { exported = false }: { exported?: boolean } = {}
): DeclaredFunction | undefined {
  for (const statement of statements) {
    const isExport = statement.type === 'ExportNamedDeclaration';
    if (exported && !isExport) continue;
    const declaration = isExport ? statement.declaration : statement;
    if (
      declaration?.type === 'FunctionDeclaration' &&
      declaration.id?.name === name
    ) {
      return { statement, fn: declaration };
    }
    if (declaration?.type !== 'VariableDeclaration') continue;
    if (declaration.kind !== 'const') continue;
    for (const declarator of declaration.declarations) {
      if (
        t.isIdentifier(declarator.id, { name }) &&
        (declarator.init?.type === 'ArrowFunctionExpression' ||
          declarator.init?.type === 'FunctionExpression')
      ) {
        return { statement, fn: declarator.init };
      }
    }
  }
  return undefined;
}

/** The local name of a `* as` import from `source`. */
export function getNamespaceImport(
  file: SourceFile,
  source: string
): string | undefined {
  for (const statement of file.statements ?? []) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.source.value !== source ||
      statement.importKind === 'type'
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportNamespaceSpecifier') {
        return specifier.local.name;
      }
    }
  }
  return undefined;
}

/** Whether `local` is called anywhere in the nodes. */
export function callsFunction(
  nodes: readonly (t.Node | null)[],
  local: string
): boolean {
  let found = false;
  for (const node of nodes) {
    if (!node) continue;
    t.traverseFast(node, (child) => {
      if (
        child.type === 'CallExpression' &&
        t.isIdentifier(child.callee, { name: local })
      ) {
        found = true;
      }
    });
  }
  return found;
}

/** The binding `name` refers to at `target`. */
export function getBindingAt(
  statements: t.Statement[],
  target: t.Node,
  name: string
): Binding | undefined {
  let binding: Binding | undefined;
  traverse(t.file(t.program(statements)), {
    enter(path) {
      if (path.node !== target) return;
      binding = path.scope.getBinding(name);
      path.stop();
    },
  });
  return binding;
}

export function getPropertyName(
  property: t.ObjectExpression['properties'][number]
): string | undefined {
  if (property.type === 'SpreadElement' || property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'StringLiteral') return property.key.value;
  return undefined;
}
