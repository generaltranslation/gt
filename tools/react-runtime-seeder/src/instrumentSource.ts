import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { JSXOpeningElement, Program } from '@babel/types';
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
      if (!isRuntimeT(path.node, bindings)) return;
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
  const named = new Set<string>();
  const namespaces = new Set<string>();

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
        named.add(specifier.local.name);
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaces.add(specifier.local.name);
      }
    }
  }
  return { named, namespaces };
}

function isRuntimeT(
  node: JSXOpeningElement,
  bindings: { named: Set<string>; namespaces: Set<string> }
): boolean {
  if (node.name.type === 'JSXIdentifier') {
    return bindings.named.has(node.name.name);
  }
  return (
    node.name.type === 'JSXMemberExpression' &&
    node.name.object.type === 'JSXIdentifier' &&
    node.name.property.type === 'JSXIdentifier' &&
    bindings.namespaces.has(node.name.object.name) &&
    node.name.property.name === 'T'
  );
}

function normalizePath(pathname: string): string {
  return pathname.replaceAll('\\', '/');
}

export { sourceProp };
