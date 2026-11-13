import { createTranslationMismatchError } from '../errors/convertErrors';
import { parse } from '../parser/parse';
import { dateTimeSkeletonFields } from '../parser/dateTimeSkeleton';
import {
  DATE_TIME_STYLE_NAMES,
  NAMED_NUMBER_STYLES,
} from '../settings/formatOptions';
import {
  SKELETON_TYPE,
  TYPE,
  type MessageFormatElement,
  type PluralOrSelectOption,
  type Skeleton,
} from '../types-dir/ast';
import {
  translationProblems,
  type CheckedBranches,
  type CheckedPlaceholder,
  type CheckTranslationOptions,
  type FormattedPlaceholder,
} from './translationRules';

/**
 * Checks a translated ICU string against its source ICU string, by the
 * rules of `checkTranslation`, and returns `undefined` when it matches, or a
 * message listing every problem. It reads any ICU the parser reads, from any
 * library, including what a message tree cannot hold, like a date pattern:
 *
 *   checkIcuTranslation('Hello, {name}!', '¡Hola, {nombre}!');
 *   // 'The translation does not match its source: "nombre" does not exist in the source; "name" is missing from the translation.'
 *
 * A style name or a skeleton is kept as written. A pattern, like
 * `{d, date, MM/dd/yyyy}`, is the translator's to localize, so where the
 * source uses one, the translation may use any pattern. An app's own style
 * name reads as a pattern.
 *
 * A source that is not valid ICU throws the parser's `SyntaxError`; a
 * translation that is not valid ICU is a problem with it, so the parser's
 * message is returned.
 */
export function checkIcuTranslation(
  sourceIcu: string,
  translationIcu: string,
  { locale }: CheckTranslationOptions = {}
): string | undefined {
  const source = readPlaceholders(parse(sourceIcu));
  let translation: MessageFormatElement[];
  try {
    translation = parse(translationIcu);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return error.message;
  }
  const problems = translationProblems(
    source,
    readPlaceholders(translation),
    locale
  );
  return problems.length ? createTranslationMismatchError(problems) : undefined;
}

function readPlaceholders(
  elements: MessageFormatElement[]
): CheckedPlaceholder[] {
  return elements.flatMap(readPlaceholder);
}

function readPlaceholder(element: MessageFormatElement): CheckedPlaceholder[] {
  switch (element.type) {
    case TYPE.literal:
    case TYPE.pound:
      return [];
    case TYPE.argument:
      return [{ name: element.value, kind: 'argument' }];
    case TYPE.number:
      return [
        readStyle(
          element.value,
          'number',
          element.style,
          Object.keys(NAMED_NUMBER_STYLES)
        ),
      ];
    case TYPE.date:
      return [
        readStyle(element.value, 'date', element.style, DATE_TIME_STYLE_NAMES),
      ];
    case TYPE.time:
      return [
        readStyle(element.value, 'time', element.style, DATE_TIME_STYLE_NAMES),
      ];
    case TYPE.tag:
      return [
        {
          name: element.value,
          kind: 'tag',
          children: readPlaceholders(element.children),
        },
      ];
    case TYPE.select:
      return [
        {
          name: element.value,
          kind: 'select',
          branches: readBranches(element.options),
        },
      ];
    case TYPE.plural:
      return [
        {
          name: element.value,
          kind: element.pluralType === 'ordinal' ? 'selectordinal' : 'plural',
          offset: element.offset,
          branches: readBranches(element.options),
        },
      ];
  }
}

function readBranches(
  options: Record<string, PluralOrSelectOption>
): CheckedBranches {
  return Object.entries(options).map(([key, { value }]) => [
    key,
    readPlaceholders(value),
  ]);
}

/**
 * A style as written. A skeleton is spelled from what the parser reads of
 * it, its tokens or its date and time fields, one space apart, so spacing is
 * no change, quoted text is no field, and `MM'd'MM` is not `MMMM`. Any style
 * text but ICU's style names is a pattern.
 */
function readStyle(
  name: string,
  kind: FormattedPlaceholder['kind'],
  style: string | Skeleton | null | undefined,
  styleNames: readonly string[]
): FormattedPlaceholder {
  if (typeof style === 'string') {
    return { name, kind, style, isPattern: !styleNames.includes(style) };
  }
  if (!style) return { name, kind, style: undefined, isPattern: false };
  const skeleton =
    style.type === SKELETON_TYPE.number
      ? style.tokens
          .map(({ stem, options }) => [stem, ...options].join('/'))
          .join(' ')
      : dateTimeSkeletonFields(style.pattern).join(' ');
  return { name, kind, style: `::${skeleton}`, isPattern: false };
}
