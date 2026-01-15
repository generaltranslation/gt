import {
  addExplicitAnchorIds,
  extractHeadingInfo,
} from './addExplicitAnchorIds.js';
import { getRelative, readFile } from '../fs/findFilepath.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { Settings } from '../types/index.js';
import * as fs from 'fs';

/**
 * Processes all translated MD/MDX files to add explicit anchor IDs
 * This preserves navigation links when headings are translated
 */
export default async function processAnchorIds(
  settings: Settings,
  includeFiles?: Set<string>
) {
  if (!settings.files) return;

  const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    settings.locales,
    settings.defaultLocale
  );
  const sourceTypeByPath = new Map<string, 'md' | 'mdx'>();
  if (resolvedPaths.md) {
    for (const filePath of resolvedPaths.md) {
      sourceTypeByPath.set(getRelative(filePath), 'md');
    }
  }
  if (resolvedPaths.mdx) {
    for (const filePath of resolvedPaths.mdx) {
      sourceTypeByPath.set(getRelative(filePath), 'mdx');
    }
  }

  // Process each locale's translated files
  const processPromises = Object.entries(fileMapping)
    .filter(([locale, filesMap]) => locale !== settings.defaultLocale) // Skip default locale
    .map(async ([locale, filesMap]) => {
      // Get all translated files whose sources are md or mdx
      const mdFiles = Object.entries(filesMap).filter(
        ([sourcePath, translatedPath]) =>
          translatedPath &&
          sourceTypeByPath.has(sourcePath) &&
          (!includeFiles || includeFiles.has(translatedPath))
      );

      for (const [sourcePath, translatedPath] of mdFiles) {
        try {
          // Check if translated file exists before processing
          if (!fs.existsSync(translatedPath)) {
            continue;
          }

          // Extract heading info from source file
          const sourceContent = readFile(sourcePath);
          const sourceHeadingMap = extractHeadingInfo(sourceContent);
          const fileTypeHint = sourceTypeByPath.get(sourcePath);

          // Read translated file and apply anchor IDs
          const translatedContent = readFile(translatedPath);
          const result = addExplicitAnchorIds(
            translatedContent,
            sourceHeadingMap,
            settings,
            sourcePath,
            translatedPath,
            fileTypeHint
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
