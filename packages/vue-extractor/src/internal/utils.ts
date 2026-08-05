import path from 'node:path';
import type * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { VueExtractionResult, VueSourceCode } from '../types.js';
import type { ExtractionLocation, VueExtractionContext } from './types.js';

export function createVueExtractionContext(
  file: string,
  source: string,
  projectRoot: string,
  includeSourceCodeContext: boolean,
  surroundingLineCount: number,
  results: VueExtractionResult[],
  errors: string[],
  warnings: Set<string>
): VueExtractionContext {
  return {
    errors,
    file,
    // Script-only extraction never reads this field. Vue SFC extraction
    // replaces it with the resolved consumer compiler's behavior before
    // traversing the template.
    implicitSlotWhitespace: 'ecmascript',
    includeSourceCodeContext,
    relativeFile: path.relative(projectRoot, file),
    results,
    source,
    surroundingLineCount,
    validatedVariableComponents: new WeakSet(),
    warnings,
  };
}

export function addVueError(
  context: VueExtractionContext,
  location: ExtractionLocation | undefined,
  whatHappened: string,
  fix?: string
): void {
  const position = location
    ? ` (${location.start.line}:${location.start.column})`
    : '';
  context.errors.push(
    `${context.file}${position}: ${createDiagnosticMessage({ whatHappened, fix })}`
  );
}

export function babelLocation(
  location: t.SourceLocation | null | undefined
): ExtractionLocation | undefined {
  if (!location) return undefined;
  return {
    start: {
      line: location.start.line,
      column: location.start.column + 1,
      offset: location.start.index ?? 0,
    },
    end: {
      line: location.end.line,
      column: location.end.column + 1,
      offset: location.end.index ?? 0,
    },
  };
}

export function createInlineMetadata(
  context: VueExtractionContext,
  location: ExtractionLocation | undefined,
  translationContext?: string
): VueExtractionResult['metadata'] {
  const metadata: VueExtractionResult['metadata'] = {
    ...(translationContext !== undefined && { context: translationContext }),
    ...(context.relativeFile && { filePaths: [context.relativeFile] }),
  };

  if (
    context.includeSourceCodeContext &&
    context.relativeFile &&
    location?.start.line &&
    location.end.line
  ) {
    const sourceCode = extractSourceCode(
      context.source,
      location.start.line,
      location.end.line,
      context.surroundingLineCount
    );
    if (sourceCode) {
      metadata.sourceCode = { [context.relativeFile]: [sourceCode] };
    }
  }

  return metadata;
}

/** Extracts source lines around a 1-based line range. */
function extractSourceCode(
  source: string,
  startLine: number,
  endLine: number,
  surroundingLineCount: number
): VueSourceCode | undefined {
  const lines = source.split('\n');
  if (lines.length === 0) return undefined;

  const targetStart = Math.max(0, startLine - 1);
  const targetEnd = Math.min(lines.length - 1, endLine - 1);
  if (targetStart > targetEnd) return undefined;

  return {
    before: lines
      .slice(Math.max(0, targetStart - surroundingLineCount), targetStart)
      .join('\n'),
    target: lines.slice(targetStart, targetEnd + 1).join('\n'),
    after: lines
      .slice(targetEnd + 1, targetEnd + 1 + surroundingLineCount)
      .join('\n'),
  };
}

export type StaticPrimitive = string | number | bigint | boolean | null;
export type StaticPrimitiveResult =
  | { ok: true; value: StaticPrimitive }
  | { ok: false };
export type StaticIdentifierResolver = (
  identifier: t.Identifier
) => StaticPrimitiveResult;

/** Removes syntax-only TypeScript, Flow, and parenthesis wrappers. */
export function unwrapExpression(
  input: t.Node | null | undefined
): t.Node | undefined {
  let current = input ?? undefined;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'TSNonNullExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSInstantiationExpression' ||
      current.type === 'TypeCastExpression' ||
      current.type === 'ParenthesizedExpression')
  ) {
    current = current.expression;
  }
  return current;
}

/** Evaluates the side-effect-free primitive subset supported by extraction. */
export function readStaticPrimitive(
  input: t.Node | null | undefined,
  resolveIdentifier?: StaticIdentifierResolver
): StaticPrimitiveResult {
  const expression = unwrapExpression(input);
  if (!expression) return { ok: false };
  if (expression.type === 'Identifier' && resolveIdentifier) {
    return resolveIdentifier(expression);
  }
  if (expression.type === 'StringLiteral') {
    return { ok: true, value: expression.value };
  }
  if (expression.type === 'NumericLiteral') {
    return { ok: true, value: expression.value };
  }
  if (expression.type === 'BigIntLiteral') {
    try {
      return { ok: true, value: BigInt(expression.value) };
    } catch {
      return { ok: false };
    }
  }
  if (expression.type === 'BooleanLiteral') {
    return { ok: true, value: expression.value };
  }
  if (expression.type === 'NullLiteral') {
    return { ok: true, value: null };
  }
  if (expression.type === 'TemplateLiteral') {
    const firstQuasi = expression.quasis[0]?.value.cooked;
    // Executable, untagged template literals always have cooked values.
    // Missing cooked data belongs to malformed or tagged-template ASTs and
    // must fail closed instead of being interpreted with different raw-text
    // semantics.
    if (firstQuasi == null) return { ok: false };
    let value = firstQuasi;
    for (let index = 0; index < expression.expressions.length; index += 1) {
      const interpolation = readStaticPrimitive(
        expression.expressions[index],
        resolveIdentifier
      );
      if (!interpolation.ok) return { ok: false };
      value += String(interpolation.value);
      const quasi = expression.quasis[index + 1]?.value.cooked;
      if (quasi == null) return { ok: false };
      value += quasi;
    }
    return { ok: true, value };
  }
  if (expression.type === 'BinaryExpression' && expression.operator === '+') {
    const left = readStaticPrimitive(expression.left, resolveIdentifier);
    const right = readStaticPrimitive(expression.right, resolveIdentifier);
    if (!left.ok || !right.ok) return { ok: false };
    if (typeof left.value === 'string' || typeof right.value === 'string') {
      return { ok: true, value: String(left.value) + String(right.value) };
    }
    if (typeof left.value === 'bigint' || typeof right.value === 'bigint') {
      return typeof left.value === 'bigint' && typeof right.value === 'bigint'
        ? { ok: true, value: left.value + right.value }
        : { ok: false };
    }
    return { ok: true, value: Number(left.value) + Number(right.value) };
  }
  if (
    expression.type === 'UnaryExpression' &&
    (expression.operator === '+' || expression.operator === '-')
  ) {
    const argument = readStaticPrimitive(
      expression.argument,
      resolveIdentifier
    );
    if (argument.ok && typeof argument.value === 'number') {
      return {
        ok: true,
        value: expression.operator === '-' ? -argument.value : argument.value,
      };
    }
    if (argument.ok && typeof argument.value === 'bigint') {
      return expression.operator === '-'
        ? { ok: true, value: -argument.value }
        : { ok: false };
    }
  }
  return { ok: false };
}
