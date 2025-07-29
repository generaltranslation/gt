import * as fs from 'fs';
import { Options, Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';

/**
 * Localizes static urls in content files.
 * Currently only supported for md and mdx files. (/docs/ -> /[locale]/docs/)
 * @param settings - The settings object containing the project configuration.
 * @returns void
 *
 * @TODO This is an experimental feature, and only works in very specific cases. This needs to be improved before
 * it can be enabled by default.
 *
 * Before this becomes a non-experimental feature, we need to:
 * - Support more file types
 * - Support more complex paths
 */
export default async function localizeStaticUrls(
  settings: Omit<
    Settings & Options,
    'ignoreErrors' | 'suppressWarnings' | 'timeout'
  >
) {
  if (
    !settings.files ||
    (Object.keys(settings.files.placeholderPaths).length === 1 &&
      settings.files.placeholderPaths.gt)
  ) {
    return;
  }
  const { resolvedPaths: sourceFiles } = settings.files;

  const fileMapping = createFileMapping(
    sourceFiles,
    settings.files.placeholderPaths,
    settings.files.transformPaths,
    settings.locales,
    settings.defaultLocale
  );

  // Process all file types at once with a single call
  await Promise.all(
    Object.entries(fileMapping).map(async ([locale, filesMap]) => {
      // Get all files that are md or mdx
      const targetFiles = Object.values(filesMap).filter(
        (path) => path.endsWith('.md') || path.endsWith('.mdx')
      );

      // Replace the placeholder path with the target path
      await Promise.all(
        targetFiles.map(async (filePath) => {
          // Get file content
          const fileContent = await fs.promises.readFile(filePath, 'utf8');
          // Localize the file
          const localizedFile = localizeStaticUrlsForFile(
            fileContent,
            settings.defaultLocale,
            locale,
            settings.experimentalHideDefaultLocale || false,
            settings.options?.docsUrlPattern
          );
          const localizedFileHrefs = localizeStaticHrefsForFile(
            localizedFile,
            settings.defaultLocale,
            locale,
            settings.experimentalHideDefaultLocale || false,
            settings.options?.docsUrlPattern
          );
          // Write the localized file to the target path
          await fs.promises.writeFile(filePath, localizedFileHrefs);
        })
      );
    })
  );
}

// Naive find and replace, in the future, construct an AST
function localizeStaticUrlsForFile(
  file: string,
  defaultLocale: string,
  targetLocale: string,
  hideDefaultLocale: boolean,
  pattern: string = '/[locale]' // eg /docs/[locale] or /[locale]
): string {
  if (!pattern.startsWith('/')) {
    pattern = '/' + pattern;
  }

  // 1. Search for all instances of:
  const patternHead = pattern.split('[locale]')[0];
  // Escape special regex characters and remove trailing slash if present
  const escapedPatternHead = patternHead
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/$/, '');

  let regex;
  if (hideDefaultLocale) {
    // Match complete markdown links: `](/docs/...)` or `](/docs)`
    regex = new RegExp(`\\]\\(${escapedPatternHead}(?:/([^)]*))?\\)`, 'g');
  } else {
    // Match complete markdown links with default locale: `](/docs/${defaultLocale}/...)` or `](/docs/${defaultLocale})`
    regex = new RegExp(
      `\\]\\(${escapedPatternHead}/${defaultLocale}(?:/([^)]*))?\\)`,
      'g'
    );
  }
  const matches = file.match(regex);

  if (!matches) {
    return file;
  }
  // 2. Replace the default locale with the target locale in all matched instances
  const localizedFile = file.replace(regex, (match, pathContent) => {
    if (hideDefaultLocale) {
      // For hideDefaultLocale, check if path already has target locale
      if (pathContent) {
        if (
          pathContent.startsWith(`${targetLocale}/`) ||
          pathContent === targetLocale
        ) {
          return match; // Already localized
        }
      }
      // Add target locale to the path
      if (!pathContent || pathContent === '') {
        return `](${patternHead}${targetLocale})`;
      }
      return `](${patternHead}${targetLocale}/${pathContent})`;
    } else {
      // For non-hideDefaultLocale, replace defaultLocale with targetLocale
      // pathContent contains everything after the default locale (no leading slash if present)
      return `](${patternHead}${targetLocale}${pathContent ? '/' + pathContent : ''})`;
    }
  });
  return localizedFile;
}

function localizeStaticHrefsForFile(
  file: string,
  defaultLocale: string,
  targetLocale: string,
  hideDefaultLocale: boolean,
  pattern: string = '/[locale]' // eg /docs/[locale] or /[locale]
): string {
  if (!pattern.startsWith('/')) {
    pattern = '/' + pattern;
  }

  // 1. Search for all instances of:
  const patternHead = pattern.split('[locale]')[0];
  // Escape special regex characters and remove trailing slash if present
  const escapedPatternHead = patternHead
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/$/, '');

  let regex;
  if (hideDefaultLocale) {
    // Match complete href attributes: `href="/docs/..."` or `href="/docs"`
    regex = new RegExp(`href="${escapedPatternHead}(?:/([^"]*))?"`, 'g');
  } else {
    // Match complete href attributes with default locale: `href="/docs/${defaultLocale}/..."` or `href="/docs/${defaultLocale}"`
    regex = new RegExp(
      `href="${escapedPatternHead}/${defaultLocale}(?:/([^"]*))?"`,
      'g'
    );
  }
  const matches = file.match(regex);

  if (!matches) {
    return file;
  }
  // 2. Replace the default locale with the target locale in all matched instances
  const localizedFile = file.replace(regex, (match, pathContent) => {
    if (hideDefaultLocale) {
      // For hideDefaultLocale, check if path already has target locale
      if (pathContent) {
        if (
          pathContent.startsWith(`${targetLocale}/`) ||
          pathContent === targetLocale
        ) {
          return match; // Already localized
        }
      }
      // Add target locale to the path
      if (!pathContent || pathContent === '') {
        return `href="${patternHead}${targetLocale}"`;
      }
      return `href="${patternHead}${targetLocale}/${pathContent}"`;
    } else {
      // For non-hideDefaultLocale, replace defaultLocale with targetLocale
      // pathContent contains everything after the default locale (no leading slash if present)
      return `href="${patternHead}${targetLocale}${pathContent ? '/' + pathContent : ''}"`;
    }
  });
  return localizedFile;
}
