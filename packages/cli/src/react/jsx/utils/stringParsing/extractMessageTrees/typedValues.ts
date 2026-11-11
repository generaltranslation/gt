import * as t from '@babel/types';
import {
  getStringVariants,
  isPlainValue,
  type TypeIssue,
} from '../../typeChecker.js';
import { assertVariantLimit } from './combinations.js';
import { NonStaticMessageError } from './diagnostics.js';
import type { TreeContext } from './types.js';

// The runtime formats a plain value as an anonymous `_gt_N` argument, but reads
// an object as a { name: value } binding or a placeholder. A Date is plain only
// for a helper: its types reject a bare Date hole, which needs date().
export function assertPlainValue(
  expression: t.Node,
  context: TreeContext,
  fix: string,
  { allowDate }: { allowDate: boolean }
): void {
  const plain = isPlainValue(
    context.config.file,
    expression.start!,
    expression.end!
  );
  if (typeof plain === 'object') throwTypeIssue(plain.issue, expression);
  if (plain === 'date' && !allowDate) {
    throw new NonStaticMessageError(
      'a Date needs date() to be formatted',
      expression,
      undefined,
      'Write ${date({ due })} or ${date(due, { style: "medium" })}'
    );
  }
  if (!plain) {
    throw new NonStaticMessageError(
      'the value is not typed as a primitive (it is an object, a symbol, any, unknown, or an unstable helper result built outside the template), so the runtime may not render it as a plain value',
      expression,
      undefined,
      fix
    );
  }
}

/** Every value of derive(expr), read from the argument's TypeScript type. */
export function deriveVariants(
  call: t.CallExpression,
  context: TreeContext
): string[] {
  const [argument] = call.arguments;
  if (call.arguments.length !== 1 || !t.isExpression(argument)) {
    throw new NonStaticMessageError(
      'derive() takes exactly one expression',
      call
    );
  }
  const result = getStringVariants(
    context.config.file,
    argument.start!,
    argument.end!
  );
  if ('variants' in result) {
    assertVariantLimit(result.variants.length, argument);
    return result.variants;
  }
  switch (result.issue) {
    case 'open':
      throw new NonStaticMessageError(
        'the derive() value is typed as any string, so its variants are unknown',
        argument,
        undefined,
        DERIVE_TYPE_FIX
      );
    case 'non-string':
      throw new NonStaticMessageError(
        'the derive() value is not typed as a string',
        argument,
        undefined,
        DERIVE_TYPE_FIX
      );
    default:
      return throwTypeIssue(result.issue, argument);
  }
}

const DERIVE_TYPE_FIX =
  'Type the value as a string literal or a union of them, such as a union type, a string enum, or an as const lookup';

function throwTypeIssue(issue: TypeIssue, node: t.Node): never {
  switch (issue) {
    case 'no-typescript':
      throw new NonStaticMessageError(
        'the typescript package is not installed, and the CLI reads values from their types',
        node,
        undefined,
        'Install typescript in the project'
      );
    case 'unsupported-typescript':
      throw new NonStaticMessageError(
        'TypeScript 7.0 has no compiler API, and the CLI reads values from their types',
        node,
        undefined,
        'Use TypeScript 7.1 or later, or TypeScript 6'
      );
    case 'typescript-error':
      throw new NonStaticMessageError(
        'the TypeScript compiler failed while reading this file',
        node
      );
    default:
      throw new NonStaticMessageError(
        'the value could not be found in the TypeScript program',
        node
      );
  }
}
