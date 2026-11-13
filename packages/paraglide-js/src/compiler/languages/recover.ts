import type { OxcError, ParseResult } from 'oxc-parser';
import type { ESTree } from '../utils/ast.js';
import type { SourceRange } from '../analysis/types.js';
import { parseCode } from '../utils/parse.js';
import type { ParseLang } from './language.js';
import { sourceOffsets, UNMAPPED, type Mapping } from './mapping.js';

const MAX_SKIPPED_EXPRESSIONS = 20;

// Tools insert short text into an expression they copy, such as Vue's `.value`.
const MAX_INSERTION_LENGTH = 16;

const ALREADY_SKIPPED = /^0 *$/;

type GeneratedRange = { start: number; end: number };

/**
 * Language tools copy a template expression that does not parse (a file being
 * edited) into their code as it is. Each one is replaced by `0` and spaces, so
 * that no position moves and the rest of the file is still analyzed.
 *
 * `program` is undefined when an error is not in a template expression.
 */
export function parseSkippingUnparsable(
  file: string,
  code: string,
  lang: ParseLang,
  mappings: readonly Mapping[],
  {
    expressions = [],
    skipCopiedText = false,
  }: {
    /** The template's expressions, from the framework's parser. */
    expressions?: readonly SourceRange[];
    /** Without `expressions`: skip the run of copied source text the error is in or follows. */
    skipCopiedText?: boolean;
  }
): { code: string; program: ESTree.Program | undefined } {
  const parsed = parseCode(file, code, { lang });
  if (!firstError(parsed)) return { code, program: parsed.program };

  return skipUnparsable(
    file,
    code,
    lang,
    mappings,
    expressions,
    skipCopiedText
  );
}

function skipUnparsable(
  file: string,
  code: string,
  lang: ParseLang,
  mappings: readonly Mapping[],
  expressions: readonly SourceRange[],
  skipCopiedText: boolean
): { code: string; program: ESTree.Program | undefined } {
  const sourceAt = sourceOffsets(mappings, code.length);
  const characters = code.split('');
  const untriedExpressions = [...expressions];

  for (let skipped = 0; ; skipped++) {
    const current = characters.join('');
    const parsed = parseCode(file, current, { lang });

    const error = firstError(parsed);
    if (!error) return { code: current, program: parsed.program };

    const isOutOfAttempts = skipped === MAX_SKIPPED_EXPRESSIONS;
    const errorOffset = error.labels?.[0]?.start;
    if (isOutOfAttempts || errorOffset === undefined)
      return { code: current, program: undefined };

    const unparsable = unparsableRanges(
      sourceAt,
      current,
      errorOffset,
      untriedExpressions,
      skipCopiedText
    );
    if (unparsable.length === 0) return { code: current, program: undefined };

    unparsable.forEach((range) => replaceWithZero(characters, range));
  }
}

function firstError({ errors }: ParseResult): OxcError | undefined {
  return errors.find((candidate) => candidate.severity === 'Error');
}

function unparsableRanges(
  sourceAt: Int32Array,
  code: string,
  errorOffset: number,
  untriedExpressions: SourceRange[],
  skipCopiedText: boolean
): GeneratedRange[] {
  const mappedOffset = lastMappedOffset(sourceAt, errorOffset);
  if (mappedOffset === undefined) return [];

  const expression = removeSmallestAround(
    untriedExpressions,
    sourceAt[mappedOffset]!
  );
  if (expression) return generatedRanges(sourceAt, code, expression);

  if (skipCopiedText) return copiedTextAround(sourceAt, code, mappedOffset);

  return [];
}

function lastMappedOffset(
  sourceAt: Int32Array,
  generatedOffset: number
): number | undefined {
  let offset = Math.min(generatedOffset, sourceAt.length - 1);
  while (offset >= 0 && sourceAt[offset] === UNMAPPED) offset--;

  return offset < 0 ? undefined : offset;
}

function removeSmallestAround(
  expressions: SourceRange[],
  sourceOffset: number
): SourceRange | undefined {
  const around = expressions.filter(
    (range) => range.start <= sourceOffset && sourceOffset <= range.end
  );
  const [smallest] = around.sort((a, b) => lengthOf(a) - lengthOf(b));

  if (smallest) expressions.splice(expressions.indexOf(smallest), 1);

  return smallest;
}

/** Everything generated for `expression`: a tool may write it more than once. */
function generatedRanges(
  sourceAt: Int32Array,
  code: string,
  expression: SourceRange
): GeneratedRange[] {
  const ranges: GeneratedRange[] = [];

  for (let offset = 0; offset < code.length; offset++) {
    const source = sourceAt[offset]!;
    const isInExpression =
      expression.start <= source && source < expression.end;
    if (!isInExpression) continue;

    const last = ranges.at(-1);
    const continuesLast =
      last && isShortInsertion(code.slice(last.end, offset));

    if (continuesLast) {
      last.end = offset + 1;
    } else {
      ranges.push({ start: offset, end: offset + 1 });
    }
  }

  return ranges;
}

/** The whole run of consecutively copied source text: `m.x(:)`, not only `m.x(:`. */
function copiedTextAround(
  sourceAt: Int32Array,
  code: string,
  mappedOffset: number
): GeneratedRange[] {
  let start = mappedOffset;
  while (start > 0 && sourceAt[start - 1] === sourceAt[start]! - 1) start--;

  let end = mappedOffset + 1;
  while (end < code.length && sourceAt[end] === sourceAt[end - 1]! + 1) end++;

  const isAlreadySkipped = ALREADY_SKIPPED.test(code.slice(start, end));

  return isAlreadySkipped ? [] : [{ start, end }];
}

function replaceWithZero(
  characters: string[],
  { start, end }: GeneratedRange
): void {
  for (let index = start; index < end; index++) {
    if (characters[index] !== '\n') characters[index] = ' ';
  }

  characters[start] = '0';
}

function isShortInsertion(text: string): boolean {
  return text.length <= MAX_INSERTION_LENGTH && !text.includes('\n');
}

function lengthOf(range: SourceRange): number {
  return range.end - range.start;
}
