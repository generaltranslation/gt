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
    })
  );
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
  if (!mdxContent.includes(patternHead.replace(/\/$/, ''))) {
    return {
      content: mdxContent,
      hasChanges: false,
      transformedUrls: [],
    };
  }

  // Parse the MDX content into an AST
  const parseProcessor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkMdx);

  const ast = parseProcessor.parse(mdxContent);
  const processedAst = parseProcessor.runSync(ast) as Root;

  // Helper function to transform URL based on pattern
  const transformUrl = (
    originalUrl: string,
    linkType: 'markdown' | 'href'
  ): string | null => {
    // Skip if URL doesn't start with pattern
    if (!originalUrl.startsWith(patternHead.replace(/\/$/, ''))) {
      return null;
    }

    let newUrl: string;

    if (hideDefaultLocale) {
      // For hideDefaultLocale: '/docs/file' -> '/docs/ja/file'
      if (
        originalUrl.startsWith(`${patternHead}${targetLocale}/`) ||
        originalUrl === `${patternHead}${targetLocale}`
      ) {
        return null; // Already localized
      }

      // Handle exact match (e.g., '/docs' -> '/docs/ja')
      if (originalUrl === patternHead.replace(/\/$/, '')) {
        newUrl = `${patternHead.replace(/\/$/, '')}/${targetLocale}`;
      } else {
        const pathAfterHead = originalUrl.slice(patternHead.length);
        newUrl = pathAfterHead
          ? `${patternHead}${targetLocale}/${pathAfterHead}`
          : `${patternHead}${targetLocale}`;
      }
    } else {
      // For non-hideDefaultLocale: '/docs/en/file' -> '/docs/ja/file'
      const expectedPath = `${patternHead}${defaultLocale}`;
      if (!originalUrl.startsWith(expectedPath)) {
        return null;
      }

      newUrl = originalUrl.replace(
        `${patternHead}${defaultLocale}`,
        `${patternHead}${targetLocale}`
      );
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

  // Visit JSX/HTML elements for href attributes: <a href="url">
  visit(
    processedAst,
    ['mdxJsxFlowElement', 'mdxJsxTextElement'],
    (node: any) => {
      if (node.name === 'a' && node.attributes) {
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

  // Convert the modified AST back to MDX string
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
