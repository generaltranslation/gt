export const createConflictingSourceFormatsError = (name: string) =>
  `Message variable "${name}" is formatted two different ways in the source, so a translation cannot restore its format.`;

export const createTranslationMismatchError = (problems: readonly string[]) =>
  `The translation does not use the same variables as its source: ${problems.join('; ')}.`;
