export const createTranslationMismatchError = (problems: readonly string[]) =>
  `The translation does not match its source: ${problems.join('; ')}.`;

export const createUnsupportedTreeFormatError = (
  placeholder: string,
  reason: string
) => `${placeholder} cannot be part of a message tree: ${reason}.`;
