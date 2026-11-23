import type * as SvelteCompiler from 'svelte/compiler';
import type { ESTree } from '../../analysis/ast.js';

type ComponentAst = {
  instance?: { content?: { body?: readonly ESTree.Statement[] } };
};

/**
 * Throws on a file Svelte rejects. Svelte 5 parses `loose`ly, as editors do, so
 * that a template expression with a syntax error does not reject the file.
 */
export function parseComponent(
  compiler: typeof SvelteCompiler,
  source: string
): unknown {
  return isSvelte5(compiler)
    ? compiler.parse(source, { modern: true, loose: true })
    : compiler.parse(source);
}

/** Where the instance script's `export let message` declare their names: Svelte 4's props. */
export function propDeclarationOffsets(ast: unknown): number[] {
  const statements = (ast as ComponentAst).instance?.content?.body ?? [];

  return statements.flatMap(exportedVariableOffsets);
}

function isSvelte5(compiler: typeof SvelteCompiler): boolean {
  return Number(compiler.VERSION?.split('.')[0]) >= 5;
}

function exportedVariableOffsets(statement: ESTree.Statement): number[] {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
  if (
    declaration?.type !== 'VariableDeclaration' ||
    declaration.kind === 'const'
  )
    return [];

  const offsets: number[] = [];

  for (const declarator of declaration.declarations) {
    if (declarator.id.type === 'Identifier') offsets.push(declarator.id.start);
  }

  return offsets;
}
