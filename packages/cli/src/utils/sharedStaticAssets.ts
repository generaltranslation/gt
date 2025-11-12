import path from 'node:path';
import fs from 'node:fs';
import fg from 'fast-glob';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import escapeHtmlInTextNodes from 'gt-remark';
import type { Settings, SharedStaticAssetsConfig } from '../types/index.js';

function derivePublicPath(outDir: string, provided?: string): string {
  if (provided) return provided;
  const norm = outDir.replace(/\\/g, '/');
  if (norm.startsWith('public/')) return '/' + norm.slice('public/'.length);
  if (norm.startsWith('static/')) return '/' + norm.slice('static/'.length);
  if (norm.startsWith('/')) return norm; // already absolute URL path
  return '/' + path.basename(norm);
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function moveFile(src: string, dest: string) {
  if (src === dest) return;
  try {
    await ensureDir(path.dirname(dest));
    await fs.promises.rename(src, dest);
  } catch (err: any) {
    // Fallback to copy+unlink for cross-device or existing files
    if (err && (err.code === 'EXDEV' || err.code === 'EEXIST' || err.code === 'ENOTEMPTY')) {
      const data = await fs.promises.readFile(src);
      await ensureDir(path.dirname(dest));
      await fs.promises.writeFile(dest, data);
      try {
        await fs.promises.unlink(src);
      } catch {}
    } else if (err && err.code === 'ENOENT') {
      // already moved or missing; ignore
      return;
    } else {
      throw err;
    }
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirEmpty(dir: string): Promise<boolean> {
  try {
    const entries = await fs.promises.readdir(dir);
    return entries.length === 0;
  } catch {
    return false;
  }
}

async function removeEmptyDirsUpwards(startDir: string, stopDir: string) {
  let current = path.resolve(startDir);
  const stop = path.resolve(stopDir);
  while (current.startsWith(stop)) {
    if (current === stop) break;
    const exists = await pathExists(current);
    if (!exists) break;
    const empty = await isDirEmpty(current);
    if (!empty) break;
    try {
      await fs.promises.rmdir(current);
    } catch {
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function stripQueryAndHash(url: string): { base: string; suffix: string } {
  const match = url.match(/^[^?#]+/);
  const base = match ? match[0] : url;
  const suffix = url.slice(base.length);
  return { base, suffix };
}

function rewriteMdxContent(
  content: string,
  filePath: string,
  pathMap: Map<string, string>
): { content: string; changed: boolean } {
  let changed = false;

  let ast: Root;
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);
    ast = processor.runSync(processor.parse(content)) as Root;
  } catch (e) {
    return { content, changed: false };
  }

  const fileDir = path.dirname(filePath);

  // Helper to resolve and possibly rewrite a URL
  const maybeRewrite = (url: string): string | null => {
    if (!url || /^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return null;
    }
    const { base, suffix } = stripQueryAndHash(url);
    // Only handle relative paths
    if (base.startsWith('/')) return null;
    const abs = path.resolve(fileDir, base);
    const normAbs = path.normalize(abs);
    const mapped = pathMap.get(normAbs);
    if (mapped) {
      changed = true;
      return mapped + suffix;
    }
    return null;
  };

  visit(ast, (node: any) => {
    // Markdown image: ![alt](url)
    if (node.type === 'image' && typeof node.url === 'string') {
      const newUrl = maybeRewrite(node.url);
      if (newUrl) node.url = newUrl;
      return;
    }
    // Markdown link: [text](url) — useful for PDFs and other downloadable assets
    if (node.type === 'link' && typeof node.url === 'string') {
      const newUrl = maybeRewrite(node.url);
      if (newUrl) node.url = newUrl;
      return;
    }
    // MDX <img src="..." />
    if (
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
      Array.isArray(node.attributes)
    ) {
      for (const attr of node.attributes) {
        if (
          attr &&
          attr.type === 'mdxJsxAttribute' &&
          (attr.name === 'src' || attr.name === 'href') &&
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
    // Preserve trailing/leading newlines similar to localizeStaticUrls
    if (out.endsWith('\n') && !content.endsWith('\n')) out = out.slice(0, -1);
    if (content.startsWith('\n') && !out.startsWith('\n')) out = '\n' + out;
    return { content: out, changed };
  } catch (e) {
    return { content, changed: false };
  }
}

export default async function processSharedStaticAssets(settings: Settings) {
  const cfg: SharedStaticAssetsConfig | undefined = settings.sharedStaticAssets as any;
  if (!cfg) return;

  const cwd = process.cwd();
  const include = toArray(cfg.include);
  if (include.length === 0) return;

  // Resolve assets
  const assetPaths = new Set<string>();
  for (let pattern of include) {
    // Treat leading '/' as repo-relative, not filesystem root
    if (pattern.startsWith('/')) pattern = pattern.slice(1);
    const matches = fg.sync(path.resolve(cwd, pattern), { absolute: true });
    for (const m of matches) assetPaths.add(path.normalize(m));
  }
  if (assetPaths.size === 0) return;

  const outDirInput = cfg.outDir.startsWith('/') ? cfg.outDir.slice(1) : cfg.outDir;
  const outDirAbs = path.resolve(cwd, outDirInput);
  const publicPath = derivePublicPath(outDirInput, cfg.publicPath);

  // Map original absolute path -> public URL
  const originalToPublic = new Map<string, string>();
  for (const abs of assetPaths) {
    const relFromRoot = path.relative(cwd, abs).replace(/\\/g, '/');
    const publicUrl = (publicPath.endsWith('/') ? publicPath.slice(0, -1) : publicPath) + '/' + relFromRoot;
    originalToPublic.set(path.normalize(abs), publicUrl);
  }

  // Move assets to outDir, preserving relative structure
  for (const abs of assetPaths) {
    const relFromRoot = path.relative(cwd, abs);
    const destAbs = path.resolve(outDirAbs, relFromRoot);
    // Skip if already in destination
    if (path.normalize(abs) === path.normalize(destAbs)) continue;
    // If destination exists, assume already moved
    try {
      const st = await fs.promises.stat(destAbs).catch(() => null);
      if (st && st.isFile()) {
        // Remove source if it still exists
        await fs.promises.unlink(abs).catch(() => {});
        await removeEmptyDirsUpwards(path.dirname(abs), cwd);
        continue;
      }
    } catch {}
    await moveFile(abs, destAbs);
    await removeEmptyDirsUpwards(path.dirname(abs), cwd);
  }

  // Rewrite references in default-locale files we send for translation
  const resolved = settings.files?.resolvedPaths || {};
  const mdFiles = [
    ...(resolved.mdx || []),
    ...(resolved.md || []),
  ];

  await Promise.all(
    mdFiles.map(async (filePath) => {
      // only rewrite existing files
      const exists = await fs.promises
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) return;
      const orig = await fs.promises.readFile(filePath, 'utf8');
      const { content: out, changed } = rewriteMdxContent(
        orig,
        filePath,
        originalToPublic
      );
      if (changed) {
        await fs.promises.writeFile(filePath, out, 'utf8');
      }
    })
  );
}
