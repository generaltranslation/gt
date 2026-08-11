import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type {
  ImportNamespaceSpecifier,
  ImportSpecifier,
  JSXOpeningElement,
  Program,
} from '@babel/types';
import { relative } from 'node:path';

const traverse =
  (
    traverseModule as unknown as {
      default?: typeof traverseModule;
    }
  ).default ?? traverseModule;
const runtimeModules = new Set(['gt-react', 'gt-next']);
const sourceProp = '__gtRuntimeSeedSource';

type Insertion = {
  index: number;
  text: string;
};

export function instrumentSource({
  code,
  file,
  cwd,
}: {
  code: string;
  file: string;
  cwd: string;
}): string {
  const ast = parse(code, {
    sourceType: 'unambiguous',
    plugins: ['decorators-legacy', 'importAttributes', 'jsx', 'typescript'],
  });
  const bindings = collectTBindings(ast.program.body);
  if (bindings.named.size === 0 && bindings.namespaces.size === 0) return code;

  const insertions: Insertion[] = [];
  traverse(ast, {
    JSXOpeningElement(path) {
      if (!isRuntimeT(path, bindings)) return;
      if (
        path.node.attributes.some(
          (attribute) =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === sourceProp
        )
      ) {
        return;
      }

      const location = path.node.loc?.start;
      const insertionIndex = path.node.name.end;
      if (!location || insertionIndex == null) return;
      const sourceFile = normalizePath(relative(cwd, file) || file);
      insertions.push({
        index: insertionIndex,
        text: ` ${sourceProp}={{ file: ${JSON.stringify(sourceFile)}, line: ${location.line}, column: ${location.column + 1} }}`,
      });
    },
  });

  return insertions
    .sort((left, right) => right.index - left.index)
    .reduce(
      (result, insertion) =>
        result.slice(0, insertion.index) +
        insertion.text +
        result.slice(insertion.index),
      code
    );
}

function collectTBindings(body: Program['body']) {
  const named = new Map<string, ImportSpecifier>();
  const namespaces = new Map<string, ImportNamespaceSpecifier>();

  for (const statement of body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      !runtimeModules.has(statement.source.value)
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === 'T'
      ) {
        named.set(specifier.local.name, specifier);
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaces.set(specifier.local.name, specifier);
      }
    }
  }
  return { named, namespaces };
}

function isRuntimeT(
  path: NodePath<JSXOpeningElement>,
  bindings: {
    named: Map<string, ImportSpecifier>;
    namespaces: Map<string, ImportNamespaceSpecifier>;
  }
): boolean {
  const { node } = path;
  if (node.name.type === 'JSXIdentifier') {
    const importSpecifier = bindings.named.get(node.name.name);
    return (
      importSpecifier != null &&
      path.scope.getBinding(node.name.name)?.path.node === importSpecifier
    );
  }
  if (
    node.name.type !== 'JSXMemberExpression' ||
    node.name.object.type !== 'JSXIdentifier' ||
    node.name.property.type !== 'JSXIdentifier' ||
    node.name.property.name !== 'T'
  ) {
    return false;
  }
  const importSpecifier = bindings.namespaces.get(node.name.object.name);
  return (
    importSpecifier != null &&
    path.scope.getBinding(node.name.object.name)?.path.node === importSpecifier
  );
}

function normalizePath(pathname: string): string {
  return pathname.replaceAll('\\', '/');
}

export { sourceProp };
