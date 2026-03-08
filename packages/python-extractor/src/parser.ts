import { Parser, Language } from 'web-tree-sitter';
import { createRequire } from 'module';

let parserPromise: Promise<Parser> | null = null;

/**
 * Lazily initializes and returns a singleton tree-sitter Parser
 * configured for Python.
 */
export function getParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = initParser();
  }
  return parserPromise;
}

async function initParser(): Promise<Parser> {
  await Parser.init();
  const parser = new Parser();

  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve(
    'tree-sitter-python/tree-sitter-python.wasm'
  );
  const Python = await Language.load(wasmPath);
  parser.setLanguage(Python);

  return parser;
}

export type { Parser };
export { type Tree, type Node as SyntaxNode } from 'web-tree-sitter';
