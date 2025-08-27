import {
  addExplicitAnchorIds,
  extractHeadingInfo,
} from './addExplicitAnchorIds.js';
import { readFile } from '../fs/findFilepath.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { Settings } from '../types/index.js';
import * as fs from 'fs';

/**
 * Processes all translated MD/MDX files to add explicit anchor IDs
 * This preserves navigation links when headings are translated
 */
export default async function processAnchorIds(settings: Settings) {
  if (!settings.files) return;

  const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    settings.locales,
    settings.defaultLocale
  );

  // Process each locale's translated files
  const processPromises = Object.entries(fileMapping)
    .filter(([locale, filesMap]) => locale !== settings.defaultLocale) // Skip default locale
    .map(async ([locale, filesMap]) => {
      // Get all translated files that are md or mdx
      const translatedFiles = Object.values(filesMap).filter(
        (path) => path && (path.endsWith('.md') || path.endsWith('.mdx'))
      );

      for (const translatedPath of translatedFiles) {
        try {
          // Find the corresponding source file
          const sourcePath = Object.keys(filesMap).find(
            (key) => filesMap[key] === translatedPath
          );
          if (!sourcePath) {
            continue;
          }

          // Extract heading info from source file
          const sourceContent = readFile(sourcePath);
          const sourceHeadingMap = extractHeadingInfo(sourceContent);

          // Read translated file and apply anchor IDs
          const translatedContent = readFile(translatedPath);
          const result = addExplicitAnchorIds(
            translatedContent,
            sourceHeadingMap,
            settings,
            sourcePath,
            translatedPath
          );

          if (result.hasChanges) {
            fs.writeFileSync(translatedPath, result.content, 'utf8');
          }
        } catch (error) {
          console.warn(
            `Failed to process IDs for ${translatedPath}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });

  await Promise.all(processPromises);
}
