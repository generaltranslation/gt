import { addExplicitAnchorIds, extractHeadingInfo } from './addExplicitAnchorIds.js';
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

  // Process MD and MDX files for each locale
  for (const fileType of ['md', 'mdx'] as const) {
    const filePaths = fileType === 'md' ? resolvedPaths.md : resolvedPaths.mdx;
    if (filePaths) {
      for (const sourcePath of filePaths) {
        try {
          // Extract heading info from source file
          const sourceContent = readFile(sourcePath);
          const sourceHeadingMap = extractHeadingInfo(sourceContent);

          // Apply anchor IDs to translated files for each locale
          for (const locale of settings.locales) {
            if (locale === settings.defaultLocale) continue; // Skip default locale

            const translatedPath = fileMapping[locale][sourcePath];
            if (translatedPath) {
              try {
                const translatedContent = readFile(translatedPath);
                const result = addExplicitAnchorIds(
                  translatedContent,
                  sourceHeadingMap,
                  settings
                );
                
                if (result.hasChanges) {
                  fs.writeFileSync(translatedPath, result.content, 'utf8');
                }
              } catch (error) {
                // Silently continue if translated file doesn't exist yet
              }
            }
          }
        } catch (error) {
          // Silently continue if source file has issues
        }
      }
    }
  }
}