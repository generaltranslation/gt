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
import { Root, Link, Literal } from 'mdast';
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx';

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
export default async function localizeStaticUrls(settings: Settings) {
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
            settings.options?.experimentalHideDefaultLocale || false,
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
            settings.options?.experimentalHideDefaultLocale || false,
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
 * Determines if a URL should be processed based on pattern matching
 */
function shouldProcessUrl(
  originalUrl: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string
): boolean {
  // Skip absolute URLs (http://, https://, //, etc.)
  if (originalUrl.includes(':')) {
    return false;
  }

  const patternWithoutSlash = patternHead.replace(/\/$/, '');

  if (targetLocale === defaultLocale) {
    // For default locale processing, check if URL contains the pattern
    return originalUrl.includes(patternWithoutSlash);
  } else {
    // For non-default locales, check if URL starts with pattern
    return originalUrl.startsWith(patternWithoutSlash);
  }
}

/**
 * Checks if a URL should be excluded based on exclusion patterns
 */
function isUrlExcluded(
  originalUrl: string,
  exclude: string[],
  defaultLocale: string
): boolean {
  const excludePatterns = exclude.map((p) =>
    p.replace(/\[locale\]/g, defaultLocale)
  );
  return excludePatterns.some((pattern) => isMatch(originalUrl, pattern));
}

/**
 * Transforms URL for default locale processing
 */
function transformDefaultLocaleUrl(
  originalUrl: string,
  patternHead: string,
  defaultLocale: string,
  hideDefaultLocale: boolean
): string | null {
  if (hideDefaultLocale) {
    // Remove locale from URLs that have it: '/docs/en/file' -> '/docs/file'
    if (originalUrl.includes(`/${defaultLocale}/`)) {
      return originalUrl.replace(`/${defaultLocale}/`, '/');
    } else if (originalUrl.endsWith(`/${defaultLocale}`)) {
      return originalUrl.replace(`/${defaultLocale}`, '');
    }
    return null; // URL doesn't have default locale
  } else {
    // Add locale to URLs that don't have it: '/docs/file' -> '/docs/en/file'
    if (
      originalUrl.includes(`/${defaultLocale}/`) ||
      originalUrl.endsWith(`/${defaultLocale}`)
    ) {
      return null; // Already has default locale
    }

    if (originalUrl.startsWith(patternHead)) {
      const pathAfterHead = originalUrl.slice(patternHead.length);
      if (pathAfterHead) {
        return `${patternHead}${defaultLocale}/${pathAfterHead}`;
      } else {
        return `${patternHead.replace(/\/$/, '')}/${defaultLocale}`;
      }
    }
    return null; // URL doesn't match pattern
  }
}

/**
 * Transforms URL for non-default locale processing with hideDefaultLocale=true
 */
function transformNonDefaultLocaleUrlWithHidden(
  originalUrl: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string
): string | null {
  // Check if already localized
  if (
    originalUrl.startsWith(`${patternHead}${targetLocale}/`) ||
    originalUrl === `${patternHead}${targetLocale}`
  ) {
    return null;
  }

  // Replace default locale with target locale
  const expectedPathWithDefaultLocale = `${patternHead}${defaultLocale}`;
  if (
    originalUrl.startsWith(`${expectedPathWithDefaultLocale}/`) ||
    originalUrl === expectedPathWithDefaultLocale
  ) {
    return originalUrl.replace(
      `${patternHead}${defaultLocale}`,
      `${patternHead}${targetLocale}`
    );
  }

  // Handle exact pattern match
  if (originalUrl === patternHead.replace(/\/$/, '')) {
    return `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
  }

  // Add target locale to URL without any locale
  const pathAfterHead = originalUrl.slice(
    originalUrl.startsWith(patternHead) ? patternHead.length : 0
  );
  return pathAfterHead
    ? `${patternHead}${targetLocale}/${pathAfterHead}`
    : `${patternHead}${targetLocale}`;
}

/**
 * Transforms URL for non-default locale processing with hideDefaultLocale=false
 */
function transformNonDefaultLocaleUrl(
  originalUrl: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string
): string | null {
  const expectedPathWithLocale = `${patternHead}${defaultLocale}`;

  if (
    originalUrl.startsWith(`${expectedPathWithLocale}/`) ||
    originalUrl === expectedPathWithLocale
  ) {
    // Replace existing default locale with target locale
    return originalUrl.replace(
      `${patternHead}${defaultLocale}`,
      `${patternHead}${targetLocale}`
    );
  } else if (originalUrl.startsWith(patternHead)) {
    // Add target locale to URL that doesn't have any locale
    const pathAfterHead = originalUrl.slice(patternHead.length);
    if (pathAfterHead) {
      return `${patternHead}${targetLocale}/${pathAfterHead}`;
    } else {
      return `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
    }
  }

  return null; // URL doesn't match pattern
}

/**
 * Main URL transformation function that delegates to specific scenarios
 */
function transformUrlPath(
  originalUrl: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string,
  hideDefaultLocale: boolean
): string | null {
  if (targetLocale === defaultLocale) {
    return transformDefaultLocaleUrl(
      originalUrl,
      patternHead,
      defaultLocale,
      hideDefaultLocale
    );
  } else if (hideDefaultLocale) {
    return transformNonDefaultLocaleUrlWithHidden(
      originalUrl,
      patternHead,
      targetLocale,
      defaultLocale
    );
  } else {
    return transformNonDefaultLocaleUrl(
      originalUrl,
      patternHead,
      targetLocale,
      defaultLocale
    );
  }
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
    // Check if URL should be processed
    if (
      !shouldProcessUrl(originalUrl, patternHead, targetLocale, defaultLocale)
    ) {
      return null;
    }

    // Transform the URL based on locale and configuration
    const newUrl = transformUrlPath(
      originalUrl,
      patternHead,
      targetLocale,
      defaultLocale,
      hideDefaultLocale
    );

    if (!newUrl) {
      return null;
    }

    // Check exclusions
    if (isUrlExcluded(originalUrl, exclude, defaultLocale)) {
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
  visit(processedAst, 'link', (node: Link) => {
    if (node.url) {
      const newUrl = transformUrl(node.url, 'markdown');
      if (newUrl) {
        node.url = newUrl;
      }
    }
  });

  // Visit JSX/HTML elements for href attributes: <a href="url"> or <Card href="url">
  visit(processedAst, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node) => {
    const jsxNode = node as MdxJsxFlowElement | MdxJsxTextElement;
    if (jsxNode.attributes) {
      for (const attr of jsxNode.attributes) {
        if (
          attr.type === 'mdxJsxAttribute' &&
          attr.name === 'href' &&
          attr.value
        ) {
          // Handle MdxJsxAttribute with string or MdxJsxAttributeValueExpression
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
  });

  // Visit raw JSX nodes for href attributes in JSX strings
  visit(processedAst, 'jsx', (node: Literal) => {
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
