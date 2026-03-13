import { generateSettings } from '../config/generateSettings.js';
import { checkFiles } from '../formats/files/checkFiles.js';

export type {
  TranslateCheckResult,
  SkippedFileInfo,
} from '../formats/files/checkFiles.js';

export async function getTranslateCheckJson(options?: {
  config?: string;
  defaultLocale?: string;
}): Promise<import('../formats/files/checkFiles.js').TranslateCheckResult> {
  const settings = await generateSettings(options ?? {});
  return checkFiles(settings);
}
