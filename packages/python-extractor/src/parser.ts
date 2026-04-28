import { Parser, Language } from 'web-tree-sitter';
import { createRequire } from 'module';

let parserPromise: Promise<Parser> | null = null;
const require = createRequire(import.meta.url);
const isBun = typeof process !== 'undefined' && !!process.versions.bun;

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
  const parserWasmPath = await resolveWasmPath(
    'web-tree-sitter/web-tree-sitter.wasm'
  );

  await Parser.init({
    locateFile(path: string) {
      if (path === 'web-tree-sitter.wasm') {
        return parserWasmPath;
      }
      return path;
    },
  });
  const parser = new Parser();

  const wasmPath = await resolveWasmPath(
    'tree-sitter-python/tree-sitter-python.wasm'
  );
  const Python = await Language.load(wasmPath);
  parser.setLanguage(Python);

  return parser;
}

async function resolveWasmPath(specifier: string): Promise<string> {
  if (!isBun) {
    return require.resolve(specifier);
  }

  switch (specifier) {
    case 'web-tree-sitter/web-tree-sitter.wasm':
      return (await import('web-tree-sitter/web-tree-sitter.wasm')).default;
    case 'tree-sitter-python/tree-sitter-python.wasm':
      return (await import('tree-sitter-python/tree-sitter-python.wasm'))
        .default;
    default:
      return require.resolve(specifier);
  }
}

export type { Parser };
export { type Tree, type Node as SyntaxNode } from 'web-tree-sitter';
