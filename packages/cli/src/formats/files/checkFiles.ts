import { Settings } from '../../types/index.js';
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';
import { aggregateFiles } from './aggregateFiles.js';

export type SkippedFileInfo = { fileName: string; reason: string };

export type TranslateCheckResult = {
  validFiles: string[];
  skippedFiles: SkippedFileInfo[];
  summary: { total: number; valid: number; skipped: number };
};

export async function checkFiles(
  settings: Settings
): Promise<TranslateCheckResult> {
  clearWarnings();

  const files = await aggregateFiles(settings);

  const warnings = getWarnings();
  const skippedFiles: SkippedFileInfo[] = warnings
    .filter((w) => w.category === 'skipped_file')
    .map((w) => ({ fileName: w.fileName, reason: w.reason }));

  const validFiles = files.map((f) => f.fileName);

  clearWarnings();

  const total = validFiles.length + skippedFiles.length;
  return {
    validFiles,
    skippedFiles,
    summary: { total, valid: validFiles.length, skipped: skippedFiles.length },
  };
}
