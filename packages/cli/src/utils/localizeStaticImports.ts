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
            settings.options?.docsImportPattern,
            settings.options?.excludeStaticImports,
            filePath.endsWith('.md')
          );
          // Write the localized file to the target path
          await fs.promises.writeFile(filePath, localizedFile);
        })
      );
    })
  );
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
  if (!mdxContent.includes(patternHead.replace(/\/$/, ''))) {
    return {
      content: mdxContent,
      hasChanges: false,
      transformedImports: [],
    };
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
        if (
          !line.trim().startsWith('import ') ||
          !line.includes(patternHead.replace(/\/$/, ''))
        ) {
          return line;
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
            // For non-hideDefaultLocale: '/components/en/file.mdx' -> '/components/ja/file.mdx'
            const expectedPath = `${patternHead}${defaultLocale}`;
            if (!fullPath.startsWith(expectedPath)) {
              continue;
            }

            newPath = fullPath.replace(
              `${patternHead}${defaultLocale}`,
              `${patternHead}${targetLocale}`
            );
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
