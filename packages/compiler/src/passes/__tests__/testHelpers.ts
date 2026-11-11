import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { jsxInsertionPass } from '../jsxInsertionPass';
import { macroExpansionPass } from '../macroExpansionPass';
import { collectionPass } from '../collectionPass';
import { injectionPass } from '../injectionPass';
import { runtimeTranslatePass } from '../runtimeTranslatePass';
import { initializeState } from '../../state/utils/initializeState';
import type { TransformState } from '../../state/types';

const PASSES = {
  jsxInsertion: jsxInsertionPass,
  macroExpansion: macroExpansionPass,
  collection: collectionPass,
  injection: injectionPass,
  runtimeTranslate: runtimeTranslatePass,
};

export type PassName = keyof typeof PASSES;

export type PipelineResult = {
  ast: t.File;
  state: TransformState;
  /** Errors reported by the collection pass */
  errors: string[];
  /** Generated code (the input code when collection reported errors) */
  code: string;
  /** hash -> jsxChildren for every <T> seen by the collection pass */
  manifest: Record<string, unknown>;
};

/**
 * Runs the given passes in order over `code`, mirroring transform() in
 * index.ts: nothing runs after a collection pass that reported errors, and
 * injection only runs when collection found content.
 */
export function runPasses(
  code: string,
  passes: PassName[],
  options: Record<string, unknown> = {}
): PipelineResult {
  const state = initializeState(options, 'test.tsx');
  const debugManifest = new Map<string, unknown>();
  state.debugManifest = debugManifest;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const result = (output: string): PipelineResult => ({
    ast,
    state,
    errors: state.errorTracker.getErrors(),
    code: output,
    manifest: Object.fromEntries(debugManifest),
  });

  for (const pass of passes) {
    if (pass === 'injection' && !state.stringCollector.hasContent()) continue;
    traverse(ast, PASSES[pass](state));
    if (pass === 'collection' && state.errorTracker.getErrors().length > 0) {
      return result(code);
    }
  }

  return result(generate(ast, { retainLines: true, compact: false }).code);
}

/** All calls to a bare identifier callee, e.g. `t(...)` */
export function findCalls(ast: t.File, calleeName: string): t.CallExpression[] {
  const calls: t.CallExpression[] = [];
  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: calleeName })) {
        calls.push(path.node);
      }
    },
  });
  return calls;
}

/** All compiled JSX calls for a component, e.g. `jsx(Component, ...)` */
export function findJsxCalls(
  ast: t.File,
  componentName: string
): t.CallExpression[] {
  const calls: t.CallExpression[] = [];
  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.arguments[0], { name: componentName })) {
        calls.push(path.node);
      }
    },
  });
  return calls;
}

/** Sources of every import declaration, in order */
export function importSources(ast: t.File): string[] {
  return ast.program.body
    .filter((node): node is t.ImportDeclaration => t.isImportDeclaration(node))
    .map((node) => node.source.value);
}

/** Names imported from `source` across all of its import declarations */
export function importedNames(ast: t.File, source: string): string[] {
  return ast.program.body
    .filter(
      (node): node is t.ImportDeclaration =>
        t.isImportDeclaration(node) && node.source.value === source
    )
    .flatMap((node) => node.specifiers)
    .filter((s): s is t.ImportSpecifier => t.isImportSpecifier(s))
    .map((s) => (s.imported as t.Identifier).name);
}

/**
 * Converts an AST of object / array / primitive literals to its JS value.
 * Any other node (identifiers, calls, ...) becomes undefined.
 */
export function literalValue(node: t.Node | null | undefined): unknown {
  if (t.isObjectExpression(node)) {
    const entries = node.properties.flatMap((prop) => {
      if (!t.isObjectProperty(prop)) return [];
      const key = t.isStringLiteral(prop.key)
        ? prop.key.value
        : (prop.key as t.Identifier).name;
      return [[key, literalValue(prop.value)]];
    });
    return Object.fromEntries(entries);
  }
  if (t.isArrayExpression(node)) return node.elements.map(literalValue);
  if (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node)
  ) {
    return node.value;
  }
  return undefined;
}
