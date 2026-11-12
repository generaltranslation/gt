export const createInvalidVariableNameError = (name: string) =>
  `Message variable "${name}" is not a valid ICU argument name: it is empty or contains whitespace or ICU syntax characters.`;

export const createInvalidBranchKeyError = (key: string) =>
  `Branch key "${key}" is not a valid ICU selector: a key must be non-empty with no whitespace or ICU syntax characters such as - or ., and only plural keys can be =N with an integer N.`;

export const createPluralCountOutsidePluralError = () =>
  'The plural count is used outside a plural or selectordinal branch.';

export const createReservedVariablePrefixError = (
  name: string,
  reservedPrefix: string
) => `Message variable "${name}" uses the reserved "${reservedPrefix}" prefix.`;

export const createInvalidFormatOptionError = (
  name: string,
  kind: string,
  reason: string
) =>
  `The ${kind} options of message variable "${name}" are invalid: ${reason}.`;

export const createConflictingFormatsError = (name: string) =>
  `Message variable "${name}" is formatted with different formatting context in one message; give each its own variable name.`;
