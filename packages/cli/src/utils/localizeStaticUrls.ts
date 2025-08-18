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
          const localizedFile = localizeStaticUrlsForFile(
            fileContent,
            settings.defaultLocale,
            settings.defaultLocale, // Process as default locale
            settings.experimentalHideDefaultLocale || false,
            settings.options?.docsUrlPattern,
            settings.options?.excludeStaticUrls
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
          // Localize the file (handles both URLs and hrefs in single AST pass)
          const localizedFile = localizeStaticUrlsForFile(
            fileContent,
            settings.defaultLocale,
            locale,
            settings.experimentalHideDefaultLocale || false,
            settings.options?.docsUrlPattern,
            settings.options?.excludeStaticUrls
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

interface UrlTransformResult {
  content: string;
  hasChanges: boolean;
  transformedUrls: Array<{
    originalPath: string;
    newPath: string;
    type: 'markdown' | 'href';
  }>;
}

/**
 * AST-based transformation for MDX files using remark-mdx
 */
function transformMdxUrls(
  mdxContent: string,
  defaultLocale: string,
  targetLocale: string,
  hideDefaultLocale: boolean,
  pattern: string = '/[locale]',
  exclude: string[] = []
): UrlTransformResult {
  const transformedUrls: Array<{
    originalPath: string;
    newPath: string;
    type: 'markdown' | 'href';
  }> = [];

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
        transformedUrls: [],
      };
    }
  } else {
    // For non-default locales, use the original logic
    if (!mdxContent.includes(patternHead.replace(/\/$/, ''))) {
      return {
        content: mdxContent,
        hasChanges: false,
        transformedUrls: [],
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
      transformedUrls: [],
    };
  }

  // Helper function to transform URL based on pattern
  const transformUrl = (
    originalUrl: string,
    linkType: 'markdown' | 'href'
  ): string | null => {
    let newUrl: string;

    // Special handling for default locale files
    if (targetLocale === defaultLocale) {
      // For default locale processing, we need to check if this URL should be processed
      const patternWithoutSlash = patternHead.replace(/\/$/, '');
      if (!originalUrl.includes(patternWithoutSlash)) {
        return null;
      }

      if (hideDefaultLocale) {
        // When hideDefaultLocale=true: remove locale from URLs that have it
        // '/docs/en/file' -> '/docs/file'
        if (originalUrl.includes(`/${defaultLocale}/`)) {
          // Remove the locale part: '/docs/en/file' -> '/docs/file'
          newUrl = originalUrl.replace(`/${defaultLocale}/`, '/');
        } else if (originalUrl.endsWith(`/${defaultLocale}`)) {
          // Remove the locale at the end: '/docs/en' -> '/docs'
          newUrl = originalUrl.replace(`/${defaultLocale}`, '');
        } else {
          // URL doesn't have default locale, leave unchanged
          return null;
        }
      } else {
        // When hideDefaultLocale=false: add locale to URLs that don't have it
        // '/docs/file' -> '/docs/en/file'
        if (
          originalUrl.includes(`/${defaultLocale}/`) ||
          originalUrl.endsWith(`/${defaultLocale}`)
        ) {
          // Already has default locale, leave unchanged
          return null;
        }

        // Check if URL starts with the pattern and add locale
        if (originalUrl.startsWith(patternHead)) {
          const pathAfterHead = originalUrl.slice(patternHead.length);
          if (pathAfterHead) {
            // '/docs/file' -> '/docs/en/file'
            newUrl = `${patternHead}${defaultLocale}/${pathAfterHead}`;
          } else {
            // '/docs' -> '/docs/en'
            newUrl = `${patternHead.replace(/\/$/, '')}/${defaultLocale}`;
          }
        } else {
          // URL doesn't match pattern, leave unchanged
          return null;
        }
      }
    } else {
      // Regular logic for non-default locales
      // Skip if URL doesn't start with pattern
      if (!originalUrl.startsWith(patternHead.replace(/\/$/, ''))) {
        return null;
      }

      if (hideDefaultLocale) {
        // For hideDefaultLocale: '/docs/file' -> '/docs/ja/file'
        // Also handle case where URL is exactly '/docs' -> '/docs/ja'
        // And handle case where URL contains default locale: '/docs/en/file' -> '/docs/ja/file'
        if (
          originalUrl.startsWith(`${patternHead}${targetLocale}/`) ||
          originalUrl === `${patternHead}${targetLocale}`
        ) {
          return null; // Already localized
        }

        // Check if URL contains default locale and replace it with target locale
        const expectedPathWithDefaultLocale = `${patternHead}${defaultLocale}`;
        if (
          originalUrl.startsWith(`${expectedPathWithDefaultLocale}/`) ||
          originalUrl === expectedPathWithDefaultLocale
        ) {
          // Replace default locale with target locale: '/docs/en/file' -> '/docs/ja/file'
          newUrl = originalUrl.replace(
            `${patternHead}${defaultLocale}`,
            `${patternHead}${targetLocale}`
          );
        } else if (originalUrl === patternHead.replace(/\/$/, '')) {
          // Handle exact match (e.g., '/docs' -> '/docs/ja')
          newUrl = `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
        } else {
          // Handle regular case without locale: '/docs/file' -> '/docs/ja/file'
          const pathAfterHead = originalUrl.slice(patternHead.length);
          newUrl = pathAfterHead
            ? `${patternHead}${targetLocale}/${pathAfterHead}`
            : `${patternHead}${targetLocale}`;
        }
      } else {
        // For non-hideDefaultLocale: handle both scenarios
        // 1. '/docs/en/file' -> '/docs/ja/file' (standard case)
        // 2. '/docs/file' -> '/docs/ja/file' (when default locale wasn't added yet)

        const expectedPathWithLocale = `${patternHead}${defaultLocale}`;
        if (
          originalUrl.startsWith(`${expectedPathWithLocale}/`) ||
          originalUrl === expectedPathWithLocale
        ) {
          // Case 1: Replace existing default locale with target locale
          newUrl = originalUrl.replace(
            `${patternHead}${defaultLocale}`,
            `${patternHead}${targetLocale}`
          );
        } else if (originalUrl.startsWith(patternHead)) {
          // Case 2: Add target locale to URL that doesn't have any locale
          const pathAfterHead = originalUrl.slice(patternHead.length);
          if (pathAfterHead) {
            newUrl = `${patternHead}${targetLocale}/${pathAfterHead}`;
          } else {
            newUrl = `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
          }
        } else {
          // URL doesn't match pattern, leave unchanged
          return null;
        }
      }
    }

    // Check exclusions
    const excludePatterns = exclude.map((p) =>
      p.replace(/\[locale\]/g, defaultLocale)
    );
    if (excludePatterns.some((pattern) => isMatch(originalUrl, pattern))) {
      return null;
    }

    transformedUrls.push({
      originalPath: originalUrl,
      newPath: newUrl,
      type: linkType,
    });
    return newUrl;
  };

  // Visit markdown link nodes: [text](url)
  visit(processedAst, 'link', (node: any) => {
    if (node.url) {
      const newUrl = transformUrl(node.url, 'markdown');
      if (newUrl) {
        node.url = newUrl;
      }
    }
  });

  // Visit JSX/HTML elements for href attributes: <a href="url"> or <Card href="url">
  visit(
    processedAst,
    ['mdxJsxFlowElement', 'mdxJsxTextElement'],
    (node: any) => {
      if (node.attributes) {
        for (const attr of node.attributes) {
          if (attr.name === 'href' && attr.value) {
            const hrefValue =
              typeof attr.value === 'string' ? attr.value : attr.value.value;
            if (typeof hrefValue === 'string') {
              const newUrl = transformUrl(hrefValue, 'href');
              if (newUrl) {
                if (typeof attr.value === 'string') {
                  attr.value = newUrl;
                } else {
                  attr.value.value = newUrl;
                }
              }
            }
          }
        }
      }
    }
  );

  // Visit raw JSX nodes for href attributes in JSX strings
  visit(processedAst, 'jsx', (node: any) => {
    if (node.value && typeof node.value === 'string') {
      const jsxContent = node.value;

      // Use regex to find href attributes in the JSX string
      const hrefRegex = /href\s*=\s*["']([^"']+)["']/g;
      let match;
      const replacements: Array<{
        start: number;
        end: number;
        oldHrefAttr: string;
        newHrefAttr: string;
      }> = [];

      // Reset regex lastIndex to avoid issues with global flag
      hrefRegex.lastIndex = 0;

      while ((match = hrefRegex.exec(jsxContent)) !== null) {
        const originalHref = match[1];
        const newUrl = transformUrl(originalHref, 'href');

        if (newUrl) {
          // Store replacement info
          const oldHrefAttr = match[0]; // The full match like 'href="/quickstart"'
          const quote = oldHrefAttr.includes('"') ? '"' : "'";
          const newHrefAttr = `href=${quote}${newUrl}${quote}`;

          replacements.push({
            start: match.index!,
            end: match.index! + oldHrefAttr.length,
            oldHrefAttr,
            newHrefAttr,
          });
        }
      }

      // Apply replacements in reverse order (from end to start) to avoid position shifts
      if (replacements.length > 0) {
        let newJsxContent = jsxContent;
        replacements
          .sort((a, b) => b.start - a.start)
          .forEach(({ start, end, newHrefAttr }) => {
            newJsxContent =
              newJsxContent.slice(0, start) +
              newHrefAttr +
              newJsxContent.slice(end);
          });

        node.value = newJsxContent;
      }
    }
  });

  // Convert the modified AST back to MDX string
  let content: string;
  try {
    const stringifyProcessor = unified()
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '_',
        strong: '*',
        rule: '-',
        ruleRepetition: 3,
        ruleSpaces: false,
      })
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);

    content = stringifyProcessor.stringify(processedAst);
  } catch (error) {
    console.warn(
      `Failed to stringify MDX content: ${error instanceof Error ? error.message : String(error)}`
    );
    console.warn(
      'Returning original content unchanged due to stringify error.'
    );
    return {
      content: mdxContent,
      hasChanges: false,
      transformedUrls: [],
    };
  }

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
    hasChanges: transformedUrls.length > 0,
    transformedUrls,
  };
}

// AST-based transformation for MDX files using remark
function localizeStaticUrlsForFile(
  file: string,
  defaultLocale: string,
  targetLocale: string,
  hideDefaultLocale: boolean,
  pattern: string = '/[locale]', // eg /docs/[locale] or /[locale]
  exclude: string[] = []
): string {
  // Use AST-based transformation for MDX files
  const result = transformMdxUrls(
    file,
    defaultLocale,
    targetLocale,
    hideDefaultLocale,
    pattern,
    exclude
  );
  return result.content;
}
