export const createTranslationMismatchError = (problems: readonly string[]) =>
  `The translation does not match its source: ${problems.join('; ')}.`;
