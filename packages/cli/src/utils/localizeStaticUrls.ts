import * as fs from 'fs';
import type { StaticLocalizationSettings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import micromatch from 'micromatch';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import type { Root, Link, Literal } from 'mdast';
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx';
import { escapeHtmlInTextNodes, normalizeCJKCharacters } from 'gt-remark';
import { parse as parseBabel } from '@babel/parser';

const { isMatch } = micromatch;

/**
 * URL-bearing JSX attributes that we localize. Intentionally limited to link
 * attributes (`href`) — NOT asset attributes like `src`, which usually point at
 * shared, locale-agnostic assets (e.g. `/docs/images/...`) that would 404 if a
 * locale prefix were added. Extend deliberately.
 */
const LOCALIZABLE_URL_ATTRIBUTES = new Set(['href']);

/**
 * Localize URL string literals that live inside an MDX expression's raw source.
 *
 * URLs can be nested arbitrarily deep inside `{...}` expressions — e.g. an
 * `<a href>` buried inside a component prop:
 *   <ParamField type={<span><a href="/docs/x">Error</a></span>} />
 * Such hrefs never appear as mdast nodes (they live in the expression's embedded
 * JS), so the mdast visitors can't reach them. We re-parse the expression source
 * with Babel — positions are local to `source`, which avoids any document-offset
 * mapping — find JSX url-attribute string literals at any depth, and surgically
 * rewrite them in place.
 *
 * `rootStringIsUrl` covers `href={"/docs/x"}`, where the expression itself is a
 * bare string literal that a url-named attribute should treat as a URL.
 *
 * Only static string literals are localized; dynamically-computed URLs
 * (template literals, identifiers, concatenation) are left untouched — a
 * fundamental limit of static localization, not a parser shortcoming.
 */
function localizeUrlsInExpressionSource(
  source: string,
  transformUrl: (url: string, linkType: 'markdown' | 'href') => string | null,
  rootStringIsUrl: boolean = false
): string {
  if (!source.trim()) return source;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ast: any;
  try {
    ast = parseBabel(source, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    // Dynamic / unparseable expression — leave it untouched.
    return source;
  }

  const replacements: Array<{ start: number; end: number; text: string }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pushLiteralReplacement = (literal: any) => {
    if (
      !literal ||
      // A bare string at statement position is parsed by Babel as a
      // DirectiveLiteral (cf. "use strict") rather than a StringLiteral.
      (literal.type !== 'StringLiteral' &&
        literal.type !== 'DirectiveLiteral') ||
      typeof literal.value !== 'string' ||
      typeof literal.start !== 'number' ||
      typeof literal.end !== 'number'
    ) {
      return;
    }
    const newUrl = transformUrl(literal.value, 'href');
    if (!newUrl) return;
    // Preserve the original quote style; URLs never contain quote chars.
    const quote = source[literal.start] === "'" ? "'" : '"';
    replacements.push({
      start: literal.start,
      end: literal.end,
      text: `${quote}${newUrl}${quote}`,
    });
  };

  // `href={"/docs/x"}`: the entire expression is the URL string.
  if (rootStringIsUrl) {
    const program = ast.program;
    const body = (program?.body ?? []) as Array<{
      type: string;
      expression?: unknown;
    }>;
    if (body.length === 1 && body[0]?.type === 'ExpressionStatement') {
      pushLiteralReplacement(body[0].expression);
    } else if (body.length === 0 && program?.directives?.length === 1) {
      // Babel parses a lone string literal as a directive, not a statement.
      pushLiteralReplacement(program.directives[0]?.value);
    }
  }

  // Walk the AST for JSX url-attributes anywhere in the expression.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seen = new Set<any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);

    if (
      node.type === 'JSXAttribute' &&
      node.name?.type === 'JSXIdentifier' &&
      LOCALIZABLE_URL_ATTRIBUTES.has(node.name.name) &&
      node.value
    ) {
      if (node.value.type === 'StringLiteral') {
        pushLiteralReplacement(node.value);
      } else if (
        node.value.type === 'JSXExpressionContainer' &&
        node.value.expression?.type === 'StringLiteral'
      ) {
        pushLiteralReplacement(node.value.expression);
      }
    }

    for (const key in node) {
      if (
        key === 'loc' ||
        key === 'start' ||
        key === 'end' ||
        key === 'range'
      ) {
        continue;
      }
      const child = node[key];
      if (child && typeof child === 'object') walk(child);
    }
  };
  walk(ast.program ?? ast);

  if (replacements.length === 0) return source;

  // Apply end-to-start so earlier offsets remain valid.
  let result = source;
  replacements
    .sort((a, b) => b.start - a.start)
    .forEach(({ start, end, text }) => {
      result = result.slice(0, start) + text + result.slice(end);
    });
  return result;
}

export type StaticUrlSettings = StaticLocalizationSettings;

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
  settings: StaticUrlSettings,
  targetLocales?: string[],
  includeFiles?: Set<string>
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
    settings.files.transformPaths ?? {},
    settings.files.transformFormats ?? {},
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
    locales.includes(settings.defaultLocale) &&
    !includeFiles // when filtering, skip default-locale pass
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
    .filter(([locale]) => locales.includes(locale)) // Filter by target locales
    .map(async ([locale, filesMap]) => {
      // Get all files that are md or mdx
      const targetFiles = Object.values(filesMap).filter(
        (p) =>
          (p.endsWith('.md') || p.endsWith('.mdx')) &&
          (!includeFiles || includeFiles.has(p))
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
    // Avoid duplicating target locale if already present
    if (originalPathArray?.[patternHeadArray.length] === targetLocale) {
      return null;
    }
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
  } catch {
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
    // For Markdown links [text](path), only process absolute-root paths starting with '/'
    // Relative markdown links should remain relative to the current page and not be localized.
    if (linkType === 'markdown') {
      const isFragment = /^\s*#/.test(originalUrl);
      const isAbsoluteRoot = originalUrl.startsWith('/');
      const looksAbsoluteWithDomain = baseDomain
        ? shouldProcessAbsoluteUrl(originalUrl, baseDomain)
        : false;
      if (!isAbsoluteRoot && !looksAbsoluteWithDomain && !isFragment) {
        return null;
      }
    }
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
    if (!jsxNode.attributes) return;
    for (const attr of jsxNode.attributes) {
      if (attr.type !== 'mdxJsxAttribute' || !attr.value) continue;

      // Plain string attribute value, e.g. <a href="/docs/x">
      if (typeof attr.value === 'string') {
        if (LOCALIZABLE_URL_ATTRIBUTES.has(attr.name)) {
          const newUrl = transformUrl(attr.value, 'href');
          if (newUrl) {
            attr.value = newUrl;
          }
        }
        continue;
      }

      // Expression attribute value. Two shapes are handled:
      //   href={"/docs/x"}                              (url attr, bare string)
      //   type={<span><a href="/docs/x">…</a></span>}  (url attr nested deep
      //                                                  inside a non-url prop)
      // The nested case never surfaces as an mdast node — it lives in the
      // expression's embedded JS — so it's localized via the source-level walk.
      if (
        typeof attr.value === 'object' &&
        attr.value.type === 'mdxJsxAttributeValueExpression' &&
        typeof attr.value.value === 'string'
      ) {
        const newValue = localizeUrlsInExpressionSource(
          attr.value.value,
          transformUrl,
          LOCALIZABLE_URL_ATTRIBUTES.has(attr.name)
        );
        if (newValue !== attr.value.value) {
          attr.value.value = newValue;
        }
      }
    }
  });

  // Visit standalone MDX expressions for URLs inside embedded JSX, e.g.
  //   {isBeta && <a href="/docs/x">Beta</a>}
  visit(processedAst, ['mdxFlowExpression', 'mdxTextExpression'], (node) => {
    const exprNode = node as unknown as Literal;
    if (typeof exprNode.value === 'string' && exprNode.value) {
      const newValue = localizeUrlsInExpressionSource(
        exprNode.value,
        transformUrl
      );
      if (newValue !== exprNode.value) {
        exprNode.value = newValue;
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
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx)
      .use(normalizeCJKCharacters)
      .use(escapeHtmlInTextNodes)
      .use(remarkStringify, {
        handlers: {
          // Handler to prevent escaping (avoids '&lt;' -> '\&lt;')
          text(node: Literal) {
            return node.value;
          },
        },
      });

    const outTree = stringifyProcessor.runSync(processedAst) as Root;
    content = stringifyProcessor.stringify(outTree);
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
