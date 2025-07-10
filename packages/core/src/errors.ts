export const translationTimeoutError = (timeout: number) =>
  `Translation request timed out after ${timeout}ms. This has either occured due to the translation of an unusually large request or a translation failure in the API.`;
