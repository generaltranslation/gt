import { GT_MESSAGE_IMPORT_SOURCES } from 'generaltranslation/internal';
import { GT_IMPORT_SOURCES } from './constants/gt/constants';
import {
  REACT_FUNCTION_VALUES,
  REACT_IMPORT_SOURCES,
} from './constants/react/constants';

const quote = (source: string) => [`'${source}'`, `"${source}"`];

const GT_SOURCES = [
  ...Object.values(GT_IMPORT_SOURCES),
  ...GT_MESSAGE_IMPORT_SOURCES,
].flatMap(quote);

const REACT_SOURCES = Object.values(REACT_IMPORT_SOURCES).flatMap(quote);

/**
 * Whether a module's text can hold an import the transform reads. Everything
 * the transform does to a module starts from an import declaration: of a GT
 * entry, or of a JSX function from a React entry. The text spells such a
 * source in quotes and such a function by its name, unless an escape spells
 * it, which takes a backslash.
 */
export function mayImportReadSource(code: string): boolean {
  const holds = (text: string) => code.includes(text);
  return (
    holds('\\') ||
    GT_SOURCES.some(holds) ||
    (REACT_SOURCES.some(holds) && REACT_FUNCTION_VALUES.some(holds))
  );
}
