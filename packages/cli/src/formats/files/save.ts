import fs from 'fs/promises';
import path from 'node:path';
import { DataFormat } from '../../types/data';
import { logSuccess } from '../../console';

/**
 * Saves translated MDX/MD file content to the appropriate location
 */
export async function saveTranslatedFile(
  translatedContent: string,
  outputDir: string,
  fileName: string,
  dataFormat: DataFormat,
  locales: string[]
): Promise<void> {
  // Create locale-specific directories if they don't exist
  for (const locale of locales) {
    const localeDir = path.join(outputDir, locale);
    await fs.mkdir(localeDir, { recursive: true });

    // Save the translated file with the appropriate extension
    const outputPath = path.join(localeDir, fileName);
    await fs.writeFile(outputPath, translatedContent);
    logSuccess(`Saved translated ${dataFormat} file to: ${outputPath}`);
  }
}
