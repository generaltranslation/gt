import { MAX_NESTING_DEPTH } from '../settings/syntax';

const TYPE_NAMES = ['number', 'date', 'time', 'plural', 'select'];
const TYPES = `${TYPE_NAMES.join(', ')} or selectordinal`;
const QUOTE_HINT = "To write < as text, quote it: '<'";

/** What each parser error says. The key is on the error as `code`. */
export const PARSER_ERRORS = {
  EXPECT_ARGUMENT_CLOSING_BRACE: 'A placeholder is not closed: add }.',
  EMPTY_ARGUMENT: 'A placeholder has no name: write {name}.',
  MALFORMED_ARGUMENT:
    'A placeholder is a name, then a type and a style if it has them, like {name}, {count, number} or {due, date, short}. A name has no white space or punctuation.',
  EXPECT_ARGUMENT_TYPE: `A type is missing after the comma: ${TYPES}.`,
  INVALID_ARGUMENT_TYPE: `A type is one of ${TYPES}.`,
  EXPECT_ARGUMENT_STYLE:
    'A style is missing after the comma: write one, or leave the comma out.',
  INVALID_NUMBER_SKELETON: 'A number skeleton is tokens after ::, like ::.00.',
  EXPECT_DATE_TIME_SKELETON: 'A skeleton is missing after ::, like ::yMMMd.',
  UNCLOSED_QUOTE_IN_ARGUMENT_STYLE: "A quote in a style is not closed: add '.",
  EXPECT_SELECT_ARGUMENT_OPTIONS:
    'A plural, select or selectordinal needs branches, like {count, plural, one {…} other {…}}.',
  EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE:
    'offset: is followed by a whole number, like offset:1.',
  INVALID_PLURAL_ARGUMENT_OFFSET_VALUE: 'The offset is too large a number.',
  EXPECT_SELECT_ARGUMENT_SELECTOR:
    'A select needs at least one branch, like other {…}.',
  EXPECT_PLURAL_ARGUMENT_SELECTOR:
    'A plural needs branches, each a category like one or a whole number like =0.',
  EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT:
    'A branch key is followed by its text in braces, like other {…}. A key has no white space or punctuation.',
  EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT:
    'A branch key is followed by its text in braces, like one {…}. After = comes a whole number: =1.5 is not a key.',
  INVALID_PLURAL_ARGUMENT_SELECTOR:
    'The number after = is too large to compare exactly.',
  DUPLICATE_SELECT_ARGUMENT_SELECTOR:
    'A branch key appears twice: only the first could ever be used.',
  DUPLICATE_PLURAL_ARGUMENT_SELECTOR:
    'A branch key appears twice: only the first could ever be used.',
  MISSING_OTHER_CLAUSE:
    'A plural, select or selectordinal needs an other branch.',
  INVALID_TAG: `A tag is a name in angle brackets, with no attributes, like <b>…</b>. ${QUOTE_HINT}.`,
  UNCLOSED_TAG: `A tag is not closed: add its closing tag, like </b>. ${QUOTE_HINT}.`,
  UNMATCHED_CLOSING_TAG: `A closing tag does not match the tag open before it. ${QUOTE_HINT}.`,
  NESTING_TOO_DEEP: `A message nests at most ${MAX_NESTING_DEPTH} levels of branches and tags.`,
} as const;

export type ParserErrorCode = keyof typeof PARSER_ERRORS;

/** ICU has these types. Intl cannot format them, and ICU deprecates `choice`. */
const UNSUPPORTED_TYPES = new Map([
  ['choice', 'choice is deprecated in ICU: write a plural or a select'],
  ['spellout', 'spellout is not supported: Intl cannot spell a number out'],
  [
    'ordinal',
    'ordinal is not supported: write a selectordinal, like {n, selectordinal, one {#st} other {#th}}',
  ],
  ['duration', 'duration is not supported: Intl has no format for it'],
]);

export const createInvalidArgumentTypeError = (type: string) => {
  const lower = type.toLowerCase();
  const unsupported = UNSUPPORTED_TYPES.get(lower);
  if (unsupported) return `${unsupported}.`;
  return lower !== type && [...TYPE_NAMES, 'selectordinal'].includes(lower)
    ? `Write the type in lower case: ${lower}.`
    : `"${type}" is not a type: use ${TYPES}.`;
};
