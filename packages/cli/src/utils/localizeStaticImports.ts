import * as fs from 'fs';
import * as path from 'path';
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
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';

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
export default async function localizeStaticImports(settings: Settings) {
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
          // Check if file exists before processing
          if (!fs.existsSync(filePath)) {
            return;
          }
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
            filePath
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
          // Check if file exists before processing
          if (!fs.existsSync(filePath)) {
            return;
          }
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
            filePath
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
 * Determines if an import path should be processed based on pattern matching
 */
function shouldProcessImportPath(
  importPath: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string
): boolean {
  const patternWithoutSlash = patternHead.replace(/\/$/, '');

  if (targetLocale === defaultLocale) {
    // For default locale processing, check if path contains the pattern
    return importPath.includes(patternWithoutSlash);
  } else {
    // For non-default locales, check if path starts with pattern
    return importPath.includes(patternWithoutSlash);
  }
}

/**
 * Checks if an import path should be excluded based on exclusion patterns
 */
function isImportPathExcluded(
  importPath: string,
  exclude: string[],
  defaultLocale: string
): boolean {
  const excludePatterns = exclude.map((p) =>
    p.replace(/\[locale\]/g, defaultLocale)
  );
  return excludePatterns.some((pattern) => isMatch(importPath, pattern));
}

/**
 * Transforms import path for default locale processing
 */
function transformDefaultLocaleImportPath(
  fullPath: string,
  patternHead: string,
  defaultLocale: string,
  hideDefaultLocale: boolean
): string | null {
  if (hideDefaultLocale) {
    // Remove locale from imports that have it: '/snippets/en/file.mdx' -> '/snippets/file.mdx'
    if (fullPath.includes(`/${defaultLocale}/`)) {
      return fullPath.replace(`/${defaultLocale}/`, '/');
    } else if (fullPath.endsWith(`/${defaultLocale}`)) {
      return fullPath.replace(`/${defaultLocale}`, '');
    }
    return null; // Path doesn't have default locale
  } else {
    // Add locale to imports that don't have it: '/snippets/file.mdx' -> '/snippets/en/file.mdx'
    if (
      fullPath.includes(`/${defaultLocale}/`) ||
      fullPath.endsWith(`/${defaultLocale}`)
    ) {
      return null; // Already has default locale
    }

    if (fullPath.startsWith(patternHead)) {
      const pathAfterHead = fullPath.slice(patternHead.length);
      if (pathAfterHead) {
        return `${patternHead}${defaultLocale}/${pathAfterHead}`;
      } else {
        return `${patternHead.replace(/\/$/, '')}/${defaultLocale}`;
      }
    }
    return null; // Path doesn't match pattern
  }
}

/**
 * Transforms import path for non-default locale processing with hideDefaultLocale=true
 */
function transformNonDefaultLocaleImportPathWithHidden(
  fullPath: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string
): string | null {
  // Check if already localized
  if (
    fullPath.startsWith(`${patternHead}${targetLocale}/`) ||
    fullPath === `${patternHead}${targetLocale}`
  ) {
    return null;
  }

  // Replace default locale with target locale
  const expectedPathWithDefaultLocale = `${patternHead}${defaultLocale}`;
  if (
    fullPath.startsWith(`${expectedPathWithDefaultLocale}/`) ||
    fullPath === expectedPathWithDefaultLocale
  ) {
    return fullPath.replace(
      `${patternHead}${defaultLocale}`,
      `${patternHead}${targetLocale}`
    );
  }

  // Handle exact pattern match
  if (fullPath === patternHead.replace(/\/$/, '')) {
    return `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
  }

  // Add target locale to path without any locale
  const pathAfterHead = fullPath.slice(patternHead.length);
  return pathAfterHead
    ? `${patternHead}${targetLocale}/${pathAfterHead}`
    : `${patternHead}${targetLocale}`;
}

/**
 * Transforms import path for non-default locale processing with hideDefaultLocale=false
 */
function transformNonDefaultLocaleImportPath(
  fullPath: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string
): string | null {
  const expectedPathWithLocale = `${patternHead}${defaultLocale}`;

  if (
    fullPath.startsWith(`${expectedPathWithLocale}/`) ||
    fullPath === expectedPathWithLocale
  ) {
    // Replace existing default locale with target locale
    return fullPath.replace(
      `${patternHead}${defaultLocale}`,
      `${patternHead}${targetLocale}`
    );
  } else if (fullPath.startsWith(patternHead)) {
    // Add target locale to path that doesn't have any locale
    const pathAfterHead = fullPath.slice(patternHead.length);
    if (pathAfterHead) {
      return `${patternHead}${targetLocale}/${pathAfterHead}`;
    } else {
      return `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
    }
  }

  return null; // Path doesn't match pattern
}

/**
 * Main import path transformation function that delegates to specific scenarios
 */
function transformImportPath(
  fullPath: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string,
  hideDefaultLocale: boolean,
  currentFilePath?: string,
  projectRoot: string = process.cwd() // fallback if not provided
): string | null {
  let newPath: string | null;

  if (targetLocale === defaultLocale) {
    newPath = transformDefaultLocaleImportPath(
      fullPath,
      patternHead,
      defaultLocale,
      hideDefaultLocale
    );
  } else if (hideDefaultLocale) {
    newPath = transformNonDefaultLocaleImportPathWithHidden(
      fullPath,
      patternHead,
      targetLocale,
      defaultLocale
    );
  } else {
    newPath = transformNonDefaultLocaleImportPath(
      fullPath,
      patternHead,
      targetLocale,
      defaultLocale
    );
  }

  if (!newPath) return null;

  if (currentFilePath) {
    let resolvedPath: string;
    if (newPath.startsWith('/')) {
      // Interpret as project-root relative
      resolvedPath = path.join(projectRoot, newPath.replace(/^\//, ''));
    } else {
      // Relative to current file
      const currentDir = path.dirname(currentFilePath);
      resolvedPath = path.resolve(currentDir, newPath);
    }

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }
  }

  return newPath;
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
  exclude: string[] = [],
  currentFilePath?: string
): ImportTransformResult {
  const transformedImports: Array<{ originalPath: string; newPath: string }> =
    [];

  // Don't auto-prefix relative patterns that start with . or ..
  if (!pattern.startsWith('/') && !pattern.startsWith('.')) {
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
  let processedAst: Root;
  try {
    const parseProcessor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);

    const ast = parseProcessor.parse(mdxContent);
    processedAst = parseProcessor.runSync(ast) as Root;
  } catch (error) {
    console.warn(
      `Failed to parse MDX content: ${error instanceof Error ? error.message : String(error)}`
    );
    console.warn('Returning original content unchanged due to parsing error.');
    return {
      content: mdxContent,
      hasChanges: false,
      transformedImports: [],
    };
  }

  let content = mdxContent;

  // Visit only mdxjsEsm nodes (import/export statements) to collect replacements
  visit(processedAst, 'mdxjsEsm', (node: MdxjsEsm) => {
    if (node.value && node.value.includes(patternHead.replace(/\/$/, ''))) {
      // Find import lines that need transformation
      const lines = node.value.split('\n');

      lines.forEach((line: string) => {
        // Only process import lines that match our pattern
        if (!line.trim().startsWith('import ')) {
          return;
        }

        // Check if this line should be processed
        if (
          !shouldProcessImportPath(
            line,
            patternHead,
            targetLocale,
            defaultLocale
          )
        ) {
          return;
        }

        // Extract the path from the import statement
        const quotes = ['"', "'", '`'];

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

          // Transform the import path
          const newPath = transformImportPath(
            fullPath,
            patternHead,
            targetLocale,
            defaultLocale,
            hideDefaultLocale,
            currentFilePath
          );

          if (!newPath) {
            continue; // No transformation needed
          }

          // Check exclusions
          if (isImportPathExcluded(fullPath, exclude, defaultLocale)) {
            continue;
          }

          // Apply the transformation to the original content
          // Simply replace the import path with the new path
          content = content.replace(
            `${quote}${fullPath}${quote}`,
            `${quote}${newPath}${quote}`
          );
          transformedImports.push({ originalPath: fullPath, newPath });
          break;
        }
      });
    }
  });

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
  currentFilePath?: string
): string {
  // Skip .md files entirely - they cannot have imports
  if (currentFilePath && currentFilePath.endsWith('.md')) {
    return file;
  }

  // For MDX files, use AST-based transformation
  const result = transformMdxImports(
    file,
    defaultLocale,
    targetLocale,
    hideDefaultLocale,
    pattern,
    exclude,
    currentFilePath
  );
  return result.content;
}
