import * as fs from 'fs';
import { Options, Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/translate.js';
import { logError } from '../console/logging.js';

/**
 * Localizes static imports in content files.
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
export default async function localizeStaticImports(
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
    settings.locales
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
          const localizedFile = localizeStaticImportsForFile(
            fileContent,
            settings.defaultLocale,
            locale,
            settings.options?.docsHideDefaultLocaleImport || false,
            settings.options?.docsImportPattern
          );
          // Write the localized file to the target path
          await fs.promises.writeFile(filePath, localizedFile);
        })
      );
    })
  );
}

// Naive find and replace, in the future, construct an AST
function localizeStaticImportsForFile(
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
  let regex;
  if (hideDefaultLocale) {
    const trimmedPatternHead = patternHead.endsWith('/')
      ? patternHead.slice(0, -1)
      : patternHead;
    // Match complete markdown links: `import { Foo } from '@/docs/[locale]/foo.md'`
    regex = new RegExp(
      `import\\s+(.*?)\\s+from\\s+(["'])${trimmedPatternHead}(.*?)\\2`,
      'g'
    );
  } else {
    // Match complete markdown links with default locale: `import { Foo } from '@/docs/${defaultLocale}/foo.md'`
    regex = new RegExp(
      `import\\s+(.*?)\\s+from\\s+(["'])${patternHead}${defaultLocale}(.*?)\\2`,
      'g'
    );
  }
  const matches = file.match(regex);

  if (!matches) {
    return file;
  }

  // 2. Replace the default locale with the target locale in all matched instances
  const localizedFile = file.replace(
    regex,
    (match, bindings, quoteType, pathContent) => {
      // get the quote type
      quoteType = match.match(/["']/)?.[0] || '"';
      if (!quoteType) {
        logError(
          `Failed to localize static imports: Import pattern must include quotes in ${pattern}`
        );
        return match;
      }
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
          return `import ${bindings} from ${quoteType}${patternHead}${targetLocale}${quoteType}`;
        }
        return `import ${bindings} from ${quoteType}${patternHead}${targetLocale}${pathContent}${quoteType}`;
      } else {
        // For non-hideDefaultLocale, replace defaultLocale with targetLocale
        // pathContent contains everything after the default locale (no leading slash if present)
        return `import ${bindings} from ${quoteType}${patternHead}${targetLocale}${pathContent}${quoteType}`;
      }
    }
  );
  return localizedFile;
}
