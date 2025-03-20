import fs from 'fs/promises';
import path from 'path';
import { DataFormat, FileExtension } from '../../types/data';

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
    console.log(`Saved translated ${dataFormat} file to: ${outputPath}`);
  }
}
