import { parse } from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import type { TransformState } from '../../state/types';
import { jsxInsertionPass } from '../../passes/jsxInsertionPass';
import { isReactJsxFunction } from '../../utils/constants/resolveIdentifier/isReactJsxFunction';

/** Preserve the compiler's existing complete-pipeline resource selection. */
export function isScriptResource(id: string): boolean {
  return /\.(?:tsx|jsx|ts|js)$/.test(id);
}

/**
 * User loaders can emit React JavaScript from MDX or another resource extension.
 * Only the auto-insertion feature handles those resources, after actual JSX
 * lowering. Do not reinterpret their original text or enable other passes.
 */
export function insertPostLoaderJsx(code: string, state: TransformState) {
  if (!state.settings.enableAutoJsxInjection) return null;
  // A cheap rejection only; parsed import bindings and calls decide eligibility.
  if (!code.includes('react') || !code.includes('import')) return null;

  let ast;
  try {
    // Generated JavaScript is required here. Raw JSX, TypeScript and unrelated
    // resource syntax must first be handled by their own configured loaders.
    ast = parse(code, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
    });
  } catch {
    return null;
  }
  let eligible = false;
  traverse(ast, {
    CallExpression(path) {
      const callee = path.get('callee');
      if (
        (callee.isIdentifier() || callee.isMemberExpression()) &&
        isReactJsxFunction(callee)
      ) {
        eligible = true;
        path.stop();
      }
    },
  });
  if (!eligible) return null;

  const before = state.statistics.jsxInsertionsCount;
  traverse(ast, jsxInsertionPass(state));
  if (state.statistics.jsxInsertionsCount === before) return null;
  return generate(ast, { retainLines: true, compact: false });
}
