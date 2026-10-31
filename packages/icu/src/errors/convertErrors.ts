export const createConflictingSourceFormatsError = (name: string) =>
  `Message variable "${name}" has two formats ICU spells the same way in the source, so a translation cannot restore them.`;

export const createTranslationMismatchError = (problems: readonly string[]) =>
  `The translation does not use the same variables as its source: ${problems.join('; ')}.`;
