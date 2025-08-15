import * as fs from 'fs';
import { Options, Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import micromatch from 'micromatch';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { Root } from 'mdast';

const { isMatch } = micromatch;

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
    settings.locales,
    settings.defaultLocale
  );

  // Process all file types at once with a single call
  const processPromises = [];

  // First, process default locale files (from source files)
  // This is needed because they might not be in the fileMapping if they're not being translated
  if (!fileMapping[settings.defaultLocale]) {
    const defaultLocaleFiles: string[] = [];

    // Collect all .md and .mdx files from sourceFiles
    if (sourceFiles.md) {
      defaultLocaleFiles.push(...sourceFiles.md);
    }
    if (sourceFiles.mdx) {
      defaultLocaleFiles.push(...sourceFiles.mdx);
    }

    if (defaultLocaleFiles.length > 0) {
      const defaultPromise = Promise.all(
        defaultLocaleFiles.map(async (filePath: string) => {
          // Get file content
          const fileContent = await fs.promises.readFile(filePath, 'utf8');
          // Localize the file using default locale
          const localizedFile = localizeStaticImportsForFile(
            fileContent,
            settings.defaultLocale,
            settings.defaultLocale, // Process as default locale
            settings.options?.docsHideDefaultLocaleImport || false,
            settings.options?.docsImportPattern,
            settings.options?.excludeStaticImports,
            filePath.endsWith('.md')
          );
          // Write the localized file back to the same path
          await fs.promises.writeFile(filePath, localizedFile);
        })
      );
      processPromises.push(defaultPromise);
    }
  }

  // Then process all other locales from fileMapping
  const mappingPromises = Object.entries(fileMapping).map(
    async ([locale, filesMap]) => {
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
            settings.options?.docsImportPattern,
            settings.options?.excludeStaticImports,
            filePath.endsWith('.md')
          );
          // Write the localized file to the target path
          await fs.promises.writeFile(filePath, localizedFile);
        })
      );
    }
  );
  processPromises.push(...mappingPromises);

  await Promise.all(processPromises);
}

interface ImportTransformResult {
  content: string;
  hasChanges: boolean;
  transformedImports: Array<{
    originalPath: string;
    newPath: string;
  }>;
}

/**
 * AST-based transformation for MDX files using remark-mdx
 */
function transformMdxImports(
  mdxContent: string,
  defaultLocale: string,
  targetLocale: string,
  hideDefaultLocale: boolean,
  pattern: string = '/[locale]',
  exclude: string[] = []
): ImportTransformResult {
  const transformedImports: Array<{ originalPath: string; newPath: string }> =
    [];

  if (!pattern.startsWith('/')) {
    pattern = '/' + pattern;
  }

  const patternHead = pattern.split('[locale]')[0];

  // Quick check: if the file doesn't contain the pattern, skip expensive AST parsing
  // For default locale processing, we also need to check if content might need adjustment
  if (targetLocale === defaultLocale) {
    // For default locale files, we always need to check as we're looking for either:
    // - paths without locale (when hideDefaultLocale=false)
    // - paths with default locale (when hideDefaultLocale=true)
    const patternWithoutSlash = patternHead.replace(/\/$/, '');
    if (!mdxContent.includes(patternWithoutSlash)) {
      return {
        content: mdxContent,
        hasChanges: false,
        transformedImports: [],
      };
    }
  } else {
    // For non-default locales, use the original logic
    if (!mdxContent.includes(patternHead.replace(/\/$/, ''))) {
      return {
        content: mdxContent,
        hasChanges: false,
        transformedImports: [],
      };
    }
  }

  // Parse the MDX content into an AST
  const parseProcessor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkMdx);

  const ast = parseProcessor.parse(mdxContent);
  const processedAst = parseProcessor.runSync(ast) as Root;

  // Visit only mdxjsEsm nodes (import/export statements)
  visit(processedAst, 'mdxjsEsm', (node: any) => {
    if (node.value && node.value.includes(patternHead.replace(/\/$/, ''))) {
      // Find and transform import paths in the node value
      const lines = node.value.split('\n');
      const transformedLines = lines.map((line: string) => {
        // Only process import lines that match our pattern
        if (!line.trim().startsWith('import ')) {
          return line;
        }

        // For default locale processing, we need to check if this line should be processed
        if (targetLocale === defaultLocale) {
          // Check if the line contains imports that need adjustment
          const patternWithoutSlash = patternHead.replace(/\/$/, '');
          if (!line.includes(patternWithoutSlash)) {
            return line;
          }
        } else {
          // For non-default locales, use the original logic
          if (!line.includes(patternHead.replace(/\/$/, ''))) {
            return line;
          }
        }

        // Extract the path from the import statement
        const quotes = ['"', "'", '`'];
        let transformedLine = line;

        for (const quote of quotes) {
          // Try both with and without trailing slash
          let startPattern = `${quote}${patternHead}`;
          let startIndex = line.indexOf(startPattern);

          // If pattern has trailing slash but path doesn't, try without slash
          if (startIndex === -1 && patternHead.endsWith('/')) {
            const patternWithoutSlash = patternHead.slice(0, -1);
            startPattern = `${quote}${patternWithoutSlash}`;
            startIndex = line.indexOf(startPattern);
          }

          if (startIndex === -1) continue;

          const pathStart = startIndex + 1; // After the quote
          const pathEnd = line.indexOf(quote, pathStart);

          if (pathEnd === -1) continue;

          const fullPath = line.slice(pathStart, pathEnd);
          let newPath: string;

          // Special handling for default locale files
          if (targetLocale === defaultLocale) {
            if (hideDefaultLocale) {
              // When hideDefaultLocale=true: remove locale from imports that have it
              // '/snippets/en/file.mdx' -> '/snippets/file.mdx'
              if (fullPath.includes(`/${defaultLocale}/`)) {
                // Remove the locale part: '/snippets/en/file.mdx' -> '/snippets/file.mdx'
                newPath = fullPath.replace(`/${defaultLocale}/`, '/');
              } else if (fullPath.endsWith(`/${defaultLocale}`)) {
                // Remove the locale at the end: '/snippets/en' -> '/snippets'
                newPath = fullPath.replace(`/${defaultLocale}`, '');
              } else {
                // Path doesn't have default locale, leave unchanged
                continue;
              }
            } else {
              // When hideDefaultLocale=false: add locale to imports that don't have it
              // '/snippets/file.mdx' -> '/snippets/en/file.mdx'
              if (
                fullPath.includes(`/${defaultLocale}/`) ||
                fullPath.endsWith(`/${defaultLocale}`)
              ) {
                // Already has default locale, leave unchanged
                continue;
              }

              // Check if path starts with the pattern and add locale
              if (fullPath.startsWith(patternHead)) {
                const pathAfterHead = fullPath.slice(patternHead.length);
                if (pathAfterHead) {
                  // '/snippets/file.mdx' -> '/snippets/en/file.mdx'
                  newPath = `${patternHead}${defaultLocale}/${pathAfterHead}`;
                } else {
                  // '/snippets' -> '/snippets/en'
                  newPath = `${patternHead.replace(/\/$/, '')}/${defaultLocale}`;
                }
              } else {
                // Path doesn't match pattern, leave unchanged
                continue;
              }
            }
          } else {
            // Regular logic for non-default locales
            if (hideDefaultLocale) {
              // For hideDefaultLocale: '/components/file.mdx' -> '/components/ja/file.mdx'
              // Also handle case where path is exactly '/components' -> '/components/ja'
              if (
                fullPath.startsWith(`${patternHead}${targetLocale}/`) ||
                fullPath === `${patternHead}${targetLocale}`
              ) {
                continue; // Already localized
              }

              // Handle exact match (e.g., '/components' -> '/components/ja')
              if (fullPath === patternHead.replace(/\/$/, '')) {
                newPath = `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
              } else {
                const pathAfterHead = fullPath.slice(patternHead.length);
                newPath = pathAfterHead
                  ? `${patternHead}${targetLocale}/${pathAfterHead}`
                  : `${patternHead}${targetLocale}`;
              }
            } else {
              // For non-hideDefaultLocale: handle both scenarios
              // 1. '/components/en/file.mdx' -> '/components/ja/file.mdx' (standard case)
              // 2. '/components/file.mdx' -> '/components/ja/file.mdx' (when default locale wasn't added yet)

              const expectedPathWithLocale = `${patternHead}${defaultLocale}`;
              if (
                fullPath.startsWith(`${expectedPathWithLocale}/`) ||
                fullPath === expectedPathWithLocale
              ) {
                // Case 1: Replace existing default locale with target locale
                newPath = fullPath.replace(
                  `${patternHead}${defaultLocale}`,
                  `${patternHead}${targetLocale}`
                );
              } else if (fullPath.startsWith(patternHead)) {
                // Case 2: Add target locale to path that doesn't have any locale
                const pathAfterHead = fullPath.slice(patternHead.length);
                if (pathAfterHead) {
                  newPath = `${patternHead}${targetLocale}/${pathAfterHead}`;
                } else {
                  newPath = `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
                }
              } else {
                // Path doesn't match pattern, leave unchanged
                continue;
              }
            }
          }

          // Check exclusions
          const excludePatterns = exclude.map((p) =>
            p.replace(/\[locale\]/g, defaultLocale)
          );
          if (excludePatterns.some((pattern) => isMatch(fullPath, pattern))) {
            continue;
          }

          // Apply the transformation
          transformedImports.push({ originalPath: fullPath, newPath });
          transformedLine =
            line.slice(0, pathStart) + newPath + line.slice(pathEnd);
          break;
        }

        return transformedLine;
      });

      node.value = transformedLines.join('\n');
    }
  });

  // Convert the modified AST back to MDX string
  const stringifyProcessor = unified()
    .use(remarkStringify)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkMdx);

  let content = stringifyProcessor.stringify(processedAst);

  // Handle newline formatting to match original input
  if (content.endsWith('\n') && !mdxContent.endsWith('\n')) {
    content = content.slice(0, -1);
  }

  // Preserve leading newlines from original content
  if (mdxContent.startsWith('\n') && !content.startsWith('\n')) {
    content = '\n' + content;
  }

  return {
    content,
    hasChanges: transformedImports.length > 0,
    transformedImports,
  };
}

/**
 * AST-based transformation for MDX files only
 */
function localizeStaticImportsForFile(
  file: string,
  defaultLocale: string,
  targetLocale: string,
  hideDefaultLocale: boolean,
  pattern: string = '/[locale]', // eg /docs/[locale] or /[locale]
  exclude: string[] = [],
  isMarkdown: boolean = false
): string {
  // Skip .md files entirely - they cannot have imports
  if (isMarkdown) {
    return file;
  }

  // For MDX files, use AST-based transformation
  const result = transformMdxImports(
    file,
    defaultLocale,
    targetLocale,
    hideDefaultLocale,
    pattern,
    exclude
  );
  return result.content;
}
