import { GT_MESSAGE_IMPORT_SOURCES } from 'generaltranslation/internal';
import { GT_IMPORT_SOURCES } from './constants/gt/constants';
import { REACT_FUNCTION_VALUES } from './constants/react/constants';

const GT_SOURCES = [
  ...Object.values(GT_IMPORT_SOURCES),
  ...GT_MESSAGE_IMPORT_SOURCES,
].flatMap((source) => [`'${source}'`, `"${source}"`]);

/**
 * Whether a module's text can hold an import the transform reads. Everything
 * the transform does to a module starts from an import declaration: of a GT
 * entry, or of a JSX function, whichever runtime exports it. The text spells
 * such an entry in quotes and such a function by its name, unless an escape
 * spells it, which takes a backslash. Whatever the transform comes to do
 * that starts from anything else needs a condition here.
 */
export function mayImportReadSource(code: string): boolean {
  const holds = (text: string) => code.includes(text);
  return (
    holds('\\') || GT_SOURCES.some(holds) || REACT_FUNCTION_VALUES.some(holds)
  );
}
