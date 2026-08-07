const PREFIX = 'gt-polyfills:';

// ---- Warnings ----

export function couldNotLocateConfigWarning(filePath: string): string {
  return `${PREFIX} Could not locate config file at "${filePath}".`;
}

export function invalidLocalesWarning(locales: string[]): string {
  return `${PREFIX} The following locales are not supported and will be skipped: ${locales.join(', ')}`;
}

export const resolveLocalesFailedWarning = `${PREFIX} Could not resolve any locales from config. Falling back to library default locale.`;

// ---- Errors ----

export function failedToReadConfigFileError(filePath: string): string {
  return `${PREFIX} Failed to read config file at "${filePath}".`;
}
