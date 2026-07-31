import path from 'node:path';
import type * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { withLocation } from '../../console/index.js';
import { extractSourceCode } from '../../react/jsx/utils/extractSourceCode.js';
import { SURROUNDING_LINE_COUNT } from '../../utils/constants.js';
import type { ExtractionLocation, VueExtractionContext } from './types.js';

export function createVueExtractionContext(
  file: string,
  includeSourceCodeContext: boolean,
  updates: VueExtractionContext['updates'],
  errors: string[],
  warnings: Set<string>
): VueExtractionContext {
  return {
    errors,
    file,
    includeSourceCodeContext,
    relativeFile: path.relative(process.cwd(), file),
    updates,
    warnings,
  };
}

export function addVueError(
  context: VueExtractionContext,
  location: ExtractionLocation | undefined,
  whatHappened: string,
  fix?: string
): void {
  context.errors.push(
    withLocation(
      context.file,
      createDiagnosticMessage({ whatHappened, fix }),
      location ? `${location.start.line}:${location.start.column}` : undefined
    )
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
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
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
      context.file,
      location.start.line,
      location.end.line,
      SURROUNDING_LINE_COUNT
    );
    if (sourceCode) {
      metadata.sourceCode = { [context.relativeFile]: [sourceCode] };
    }
  }

  return metadata;
}

export type StaticPrimitive = string | number | boolean | null;

export function readStaticPrimitive(
  input: t.Node | null | undefined
): { ok: true; value: StaticPrimitive } | { ok: false } {
  if (!input) return { ok: false };

  if (
    input.type === 'TSAsExpression' ||
    input.type === 'TSTypeAssertion' ||
    input.type === 'TSNonNullExpression' ||
    input.type === 'TypeCastExpression'
  ) {
    return readStaticPrimitive(input.expression);
  }
  if (input.type === 'ParenthesizedExpression') {
    return readStaticPrimitive(input.expression);
  }
  if (input.type === 'StringLiteral') {
    return { ok: true, value: input.value };
  }
  if (input.type === 'NumericLiteral') {
    return { ok: true, value: input.value };
  }
  if (input.type === 'BooleanLiteral') {
    return { ok: true, value: input.value };
  }
  if (input.type === 'NullLiteral') {
    return { ok: true, value: null };
  }
  if (input.type === 'TemplateLiteral' && input.expressions.length === 0) {
    return {
      ok: true,
      value: input.quasis
        .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
        .join(''),
    };
  }
  if (
    input.type === 'UnaryExpression' &&
    (input.operator === '+' || input.operator === '-')
  ) {
    const argument = readStaticPrimitive(input.argument);
    if (argument.ok && typeof argument.value === 'number') {
      return {
        ok: true,
        value: input.operator === '-' ? -argument.value : argument.value,
      };
    }
  }
  return { ok: false };
}
