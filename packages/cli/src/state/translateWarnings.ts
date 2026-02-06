export type WarningCategory =
  | 'skipped_file'
  | 'failed_move'
  | 'failed_translation'
  | 'failed_download';

export type TranslateWarning = {
  category: WarningCategory;
  fileName: string;
  reason: string;
};

const warnings: TranslateWarning[] = [];

export function recordWarning(
  category: WarningCategory,
  fileName: string,
  reason: string
) {
  warnings.push({ category, fileName, reason });
}

export function getWarnings(): TranslateWarning[] {
  return warnings;
}

export function hasWarnings(): boolean {
  return warnings.length > 0;
}

export function clearWarnings() {
  warnings.length = 0;
}
