/**
 * Special identifiers
 * TODO: add tracking for these identifiers
 */
export const OTHER_IDENTIFIERS = [
  'undefined',
  'NaN',
  'Infinity',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'console',
  'window',
  'document',
  'global',
] as const;

export enum OTHER_IDENTIFIERS_ENUM {
  UNDEFINED = 'undefined',
  NAN = 'NaN',
  INFINITY = 'Infinity',
  OBJECT = 'Object',
  ARRAY = 'Array',
  STRING = 'String',
  NUMBER = 'Number',
  BOOLEAN = 'Boolean',
  CONSOLE = 'console',
  WINDOW = 'window',
  DOCUMENT = 'document',
  GLOBAL = 'global',
}

export type OtherIdentifier = (typeof OTHER_IDENTIFIERS)[number];

/**
 * List of invalid identifiers (cause runtime error but no build error)
 */
export const INVALID_IDENTIFIERS = [
  OTHER_IDENTIFIERS_ENUM.CONSOLE,
  OTHER_IDENTIFIERS_ENUM.WINDOW,
  OTHER_IDENTIFIERS_ENUM.DOCUMENT,
  OTHER_IDENTIFIERS_ENUM.GLOBAL,
];

export type InvalidIdentifier = (typeof INVALID_IDENTIFIERS)[number];
