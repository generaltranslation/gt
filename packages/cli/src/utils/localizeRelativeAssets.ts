import * as fs from 'fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import escapeHtmlInTextNodes from 'gt-remark';
import { Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';

type RewriteResult = { content: string; hasChanges: boolean };

function stripQueryAndHash(url: string): { base: string; suffix: string } {
  const match = url.match(/^[^?#]+/);
  const base = match ? match[0] : url;
  const suffix = url.slice(base.length);
  return { base, suffix };
}

function isSkippableUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/')) return true;
  if (/^(https?:)?\/\//i.test(url)) return true;
  if (url.startsWith('data:')) return true;
  if (url.startsWith('#')) return true;
  if (url.startsWith('mailto:')) return true;
  if (url.startsWith('tel:')) return true;
  return false;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function isSubPath(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function localizeRelativeAssetsForContent(
  content: string,
  sourcePath: string,
  targetPath: string,
  cwd: string
): RewriteResult {
  let changed = false;

  let ast: Root;
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);
    ast = processor.runSync(processor.parse(content)) as Root;
  } catch {
    return { content, hasChanges: false };
  }

  const sourceDir = path.dirname(sourcePath);
  const targetDir = path.dirname(targetPath);

  const maybeRewrite = (url: string): string | null => {
    if (isSkippableUrl(url)) return null;
    const { base, suffix } = stripQueryAndHash(url);
    if (isSkippableUrl(base)) return null;

    const targetResolved = path.resolve(targetDir, base);
    if (fs.existsSync(targetResolved)) {
      return null;
    }

    const sourceResolved = path.resolve(sourceDir, base);
    if (!fs.existsSync(sourceResolved)) {
      return null;
    }

    let newPath: string;
    if (isSubPath(sourceResolved, cwd)) {
      newPath = '/' + toPosix(path.relative(cwd, sourceResolved));
    } else {
      const rel = toPosix(path.relative(targetDir, sourceResolved));
      newPath = rel || toPosix(path.basename(sourceResolved));
    }

    if (newPath === base) return null;
    changed = true;
    return newPath + suffix;
  };

  visit(ast, (node: any) => {
    if (node.type === 'image' && typeof node.url === 'string') {
      const newUrl = maybeRewrite(node.url);
      if (newUrl) node.url = newUrl;
      return;
    }
    if (
      (node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement') &&
      node.name === 'img' &&
      Array.isArray(node.attributes)
    ) {
      for (const attr of node.attributes) {
        if (
          attr &&
          attr.type === 'mdxJsxAttribute' &&
          attr.name === 'src' &&
          typeof attr.value === 'string'
        ) {
          const newUrl = maybeRewrite(attr.value);
          if (newUrl) attr.value = newUrl;
        }
      }
    }
  });

  try {
    const s = unified()
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx)
      .use(escapeHtmlInTextNodes)
      .use(remarkStringify, {
        handlers: {
          text(node: any) {
            return node.value;
          },
        },
      });
    const outTree = s.runSync(ast);
    let out = s.stringify(outTree as any);
    if (out.endsWith('\n') && !content.endsWith('\n')) out = out.slice(0, -1);
    if (content.startsWith('\n') && !out.startsWith('\n')) out = '\n' + out;
    return { content: out, hasChanges: changed };
  } catch {
    return { content, hasChanges: false };
  }
}

export default async function localizeRelativeAssets(
  settings: Settings,
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
  const locales = targetLocales || settings.locales;

  const fileMapping = createFileMapping(
    sourceFiles,
    settings.files.placeholderPaths,
    settings.files.transformPaths,
    settings.locales,
    settings.defaultLocale
  );

  const cwd = process.cwd();
  const processPromises = Object.entries(fileMapping)
    .filter(([locale]) => locales.includes(locale))
    .map(async ([locale, filesMap]) => {
      const reverseMap = new Map<string, string>();
      for (const [sourcePath, targetPath] of Object.entries(filesMap)) {
        reverseMap.set(targetPath, sourcePath);
      }
      const targetFiles = Object.values(filesMap).filter(
        (p) =>
          (p.endsWith('.md') || p.endsWith('.mdx')) &&
          (!includeFiles || includeFiles.has(p))
      );

      await Promise.all(
        targetFiles.map(async (targetPath) => {
          if (!fs.existsSync(targetPath)) return;
          const sourcePath = reverseMap.get(targetPath);
          if (!sourcePath) return;
          if (!fs.existsSync(sourcePath)) return;

          const content = await fs.promises.readFile(targetPath, 'utf8');
          const result = localizeRelativeAssetsForContent(
            content,
            sourcePath,
            targetPath,
            cwd
          );
          if (result.hasChanges) {
            await fs.promises.writeFile(targetPath, result.content);
          }
        })
      );
    });

  await Promise.all(processPromises);
}
