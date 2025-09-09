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
export default async function localizeStaticUrls(
  settings: Settings,
  targetLocales?: string[]
) {
  if (
    !settings.files ||
    (Object.keys(settings.files.placeholderPaths).length === 1 &&
      settings.files.placeholderPaths.gt)
  ) {
    return;
  }
  const { resolvedPaths: sourceFiles } = settings.files;

  // Use filtered locales if provided, otherwise use all locales
  const locales = targetLocales || settings.locales;

  const fileMapping = createFileMapping(
    sourceFiles,
    settings.files.placeholderPaths,
    settings.files.transformPaths,
    settings.locales, // Always use all locales for mapping, filter later
    settings.defaultLocale
  );

  // Process all file types at once with a single call
  const processPromises = [];

  // First, process default locale files (from source files)
  // This is needed because they might not be in the fileMapping if they're not being translated
  // Only process default locale if it's in the target locales filter
  if (
    !fileMapping[settings.defaultLocale] &&
    locales.includes(settings.defaultLocale)
  ) {
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
          const result = localizeStaticUrlsForFile(
            fileContent,
            settings.defaultLocale,
            settings.defaultLocale, // Process as default locale
            settings.options?.experimentalHideDefaultLocale || false,
            settings.options?.docsUrlPattern,
            settings.options?.excludeStaticUrls,
            settings.options?.baseDomain
          );
          // Only write the file if there were changes
          if (result.hasChanges) {
            await fs.promises.writeFile(filePath, result.content);
          }
        })
      );
      processPromises.push(defaultPromise);
    }
  }

  // Then process all other locales from fileMapping
  const mappingPromises = Object.entries(fileMapping)
    .filter(([locale, filesMap]) => locales.includes(locale)) // Filter by target locales
    .map(async ([locale, filesMap]) => {
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
          // Localize the file (handles both URLs and hrefs in single AST pass)
          const result = localizeStaticUrlsForFile(
            fileContent,
            settings.defaultLocale,
            locale,
            settings.options?.experimentalHideDefaultLocale || false,
            settings.options?.docsUrlPattern,
            settings.options?.excludeStaticUrls,
            settings.options?.baseDomain
          );
          // Only write the file if there were changes
          if (result.hasChanges) {
            await fs.promises.writeFile(filePath, result.content);
          }
        })
      );
    });
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
  defaultLocale: string,
  baseDomain?: string
): boolean {
  // Check fragment-only URLs like "#id-name"
  if (/^\s*#/.test(originalUrl)) {
    return false;
  }

  const patternWithoutSlash = patternHead.replace(/\/$/, '');

  // Handle absolute URLs with baseDomain
  let urlToCheck = originalUrl;
  if (baseDomain && originalUrl.startsWith(baseDomain)) {
    urlToCheck = originalUrl.substring(baseDomain.length);
  }

  if (targetLocale === defaultLocale) {
    // For default locale processing, check if URL contains the pattern
    return urlToCheck.includes(patternWithoutSlash);
  } else {
    // For non-default locales, check if URL starts with pattern
    return urlToCheck.startsWith(patternWithoutSlash);
  }
}

/**
 * Determines if a URL should be processed based on the base domain
 */
function shouldProcessAbsoluteUrl(
  originalUrl: string,
  baseDomain: string
): boolean {
  return originalUrl.startsWith(baseDomain);
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
 * Main URL transformation function that delegates to specific scenarios
 */
export function transformUrlPath(
  originalUrl: string,
  patternHead: string,
  targetLocale: string,
  defaultLocale: string,
  hideDefaultLocale: boolean
): string | null {
  const originalPathArray = originalUrl
    .split('/')
    .filter((path) => path !== '');
  const patternHeadArray = patternHead.split('/').filter((path) => path !== '');

  // check if the pattern head matches the original path
  if (!checkIfPathMatchesPattern(originalPathArray, patternHeadArray)) {
    return null;
  }

  if (patternHeadArray.length > originalPathArray.length) {
    return null; // Pattern is longer than the URL path
  }

  let result = null;
  if (targetLocale === defaultLocale) {
    if (hideDefaultLocale) {
      // check if default locale is already present
      if (originalPathArray?.[patternHeadArray.length] !== defaultLocale) {
        return null;
      }

      // remove default locale
      const newPathArray = [
        ...originalPathArray.slice(0, patternHeadArray.length),
        ...originalPathArray.slice(patternHeadArray.length + 1),
      ];

      result = newPathArray.join('/');
    } else {
      // check if default locale is already present
      if (originalPathArray?.[patternHeadArray.length] === defaultLocale) {
        return null;
      }

      // insert default locale
      const newPathArray = [
        ...originalPathArray.slice(0, patternHeadArray.length),
        defaultLocale,
        ...originalPathArray.slice(patternHeadArray.length),
      ];

      result = newPathArray.join('/');
    }
  } else if (hideDefaultLocale) {
    const newPathArray = [
      ...originalPathArray.slice(0, patternHeadArray.length),
      targetLocale,
      ...originalPathArray.slice(patternHeadArray.length),
    ];

    result = newPathArray.join('/');
  } else {
    // check default locale
    if (originalPathArray?.[patternHeadArray.length] !== defaultLocale) {
      return null;
    }

    // replace default locale with target locale
    const newPathArray = [...originalPathArray];
    newPathArray[patternHeadArray.length] = targetLocale;

    result = newPathArray.join('/');
  }

  // check for leading and trailing slashes
  if (originalUrl.startsWith('/')) {
    result = '/' + result;
  }
  if (originalUrl.endsWith('/')) {
    result = result + '/';
  }

  return result;
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
  exclude: string[] = [],
  baseDomain?: string
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
      transformedUrls,
    };
  }

  // Helper function to transform URL based on pattern
  const transformUrl = (
    originalUrl: string,
    linkType: 'markdown' | 'href'
  ): string | null => {
    // Check if URL should be processed
    if (
      !shouldProcessUrl(
        originalUrl,
        patternHead,
        targetLocale,
        defaultLocale,
        baseDomain
      )
    ) {
      return null;
    }

    // Skip absolute URLs (http://, https://, //, etc.)
    if (baseDomain && shouldProcessAbsoluteUrl(originalUrl, baseDomain)) {
      // Get everything after the base domain
      const afterDomain = originalUrl.substring(baseDomain.length);

      const transformedPath = transformUrlPath(
        afterDomain,
        patternHead,
        targetLocale,
        defaultLocale,
        hideDefaultLocale
      );
      if (!transformedPath) {
        return null;
      }
      transformedUrls.push({
        originalPath: originalUrl,
        newPath: transformedPath,
        type: linkType,
      });
      return transformedPath ? baseDomain + transformedPath : null;
    }

    // Exclude colon-prefixed URLs (http://, https://, //, etc.)
    if (originalUrl.split('?')[0].includes(':')) {
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
  exclude: string[] = [],
  baseDomain?: string
): UrlTransformResult {
  // Use AST-based transformation for MDX files
  return transformMdxUrls(
    file,
    defaultLocale,
    targetLocale,
    hideDefaultLocale,
    pattern,
    exclude,
    baseDomain || ''
  );
}

function cleanPath(path: string): string {
  let cleanedPath = path.startsWith('/') ? path.slice(1) : path;
  cleanedPath = cleanedPath.endsWith('/')
    ? cleanedPath.slice(0, -1)
    : cleanedPath;
  return cleanedPath;
}

function checkIfPathMatchesPattern(
  originalUrlArray: string[],
  patternHeadArray: string[]
): boolean {
  // check if the pattern head matches the original path
  for (let i = 0; i < patternHeadArray.length; i++) {
    if (patternHeadArray[i] !== originalUrlArray?.[i]) {
      return false;
    }
  }

  return true;
}
