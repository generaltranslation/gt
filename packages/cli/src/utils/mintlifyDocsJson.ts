import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import { Settings } from '../types/index.js';

type JsonRecord = Record<string, unknown>;

export function applyMintlifyDocsJsonFilter(
  settings: Settings,
  cwd: string
): void {
  if (!settings.options?.mintlify?.useDocsJsonNavigation) return;
  if (!settings.files) return;

  const docsJsonPath = resolveDocsJsonPath(cwd);
  if (!docsJsonPath) {
    logger.warn(
      'Mintlify docs.json not found. Skipping docs.json navigation filtering.'
    );
    return;
  }

  const pages = readDocsJsonPages(docsJsonPath, settings.defaultLocale);
  if (pages.size === 0) {
    logger.warn(
      'No pages found in docs.json navigation. Skipping docs.json navigation filtering.'
    );
    return;
  }

  const normalizedPages = normalizePages(pages);
  const pageList = Array.from(normalizedPages);
  const matchedPages = new Set<string>();

  const filterByPages = (filePaths?: string[], placeholderPaths?: string[]) => {
    if (!filePaths || !placeholderPaths) {
      return { filePaths, placeholderPaths };
    }
    const nextFiles: string[] = [];
    const nextPlaceholders: string[] = [];
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const relativeNoExt = stripExtension(
        toPosix(path.relative(cwd, filePath))
      );
      const matches = pageList.some((page) => {
        const match = relativeNoExt === page;
        if (match) {
          matchedPages.add(page);
        }
        return match;
      });
      if (matches) {
        nextFiles.push(filePath);
        nextPlaceholders.push(placeholderPaths[i]);
      }
    }
    return { filePaths: nextFiles, placeholderPaths: nextPlaceholders };
  };

  const filteredMdx = filterByPages(
    settings.files.resolvedPaths.mdx,
    settings.files.placeholderPaths.mdx
  );
  const filteredMd = filterByPages(
    settings.files.resolvedPaths.md,
    settings.files.placeholderPaths.md
  );

  settings.files.resolvedPaths.mdx = filteredMdx.filePaths;
  settings.files.placeholderPaths.mdx = filteredMdx.placeholderPaths;
  settings.files.resolvedPaths.md = filteredMd.filePaths;
  settings.files.placeholderPaths.md = filteredMd.placeholderPaths;

  const missingPages = pageList.filter((page) => !matchedPages.has(page));
  if (missingPages.length > 0) {
    logger.warn(
      `Some docs.json pages were not found in your files config: ${missingPages
        .slice(0, 5)
        .join(', ')}${missingPages.length > 5 ? '...' : ''}`
    );
  }
}

function resolveDocsJsonPath(cwd: string): string | null {
  const docsJsonPath = path.join(cwd, 'docs.json');
  if (fs.existsSync(docsJsonPath)) return docsJsonPath;
  const mintJsonPath = path.join(cwd, 'mint.json');
  if (fs.existsSync(mintJsonPath)) return mintJsonPath;
  return null;
}

function readDocsJsonPages(
  filePath: string,
  defaultLocale: string
): Set<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return new Set();
  }

  if (!isRecord(parsed)) return new Set();
  const navigation = parsed.navigation;
  if (!isRecord(navigation)) return new Set();

  const navigationRoot = selectNavigationRoot(navigation, defaultLocale);
  if (!navigationRoot) return new Set();

  const pages = new Set<string>();
  collectPages(navigationRoot, pages);
  return pages;
}

function selectNavigationRoot(
  navigation: JsonRecord,
  defaultLocale: string
): unknown | null {
  const languages = navigation.languages;
  if (Array.isArray(languages)) {
    const byLocale = languages.find(
      (entry) =>
        isRecord(entry) &&
        typeof entry.language === 'string' &&
        entry.language === defaultLocale
    );
    return byLocale ?? languages[0] ?? null;
  }

  return navigation;
}

function collectPages(node: unknown, pages: Set<string>): void {
  if (typeof node === 'string') {
    const normalized = normalizePage(node);
    if (normalized) pages.add(normalized);
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectPages(item, pages));
    return;
  }

  if (!isRecord(node)) return;

  for (const [key, value] of Object.entries(node)) {
    if (key === 'pages' && Array.isArray(value)) {
      value.forEach((item) => collectPages(item, pages));
      continue;
    }
    collectPages(value, pages);
  }
}

function normalizePage(page: string): string | null {
  let normalized = page.trim();
  if (!normalized) return null;
  normalized = normalized.split('#')[0]?.split('?')[0] ?? normalized;
  normalized = normalized.replace(/^\.\//, '').replace(/^\/+/, '');
  normalized = normalized.replace(/\.(mdx|md)$/i, '');
  return normalized || null;
}

function normalizePages(pages: Set<string>): Set<string> {
  const normalized = new Set<string>();
  for (const page of pages) {
    const cleaned = normalizePage(page);
    if (!cleaned) continue;
    normalized.add(cleaned);
  }
  return normalized;
}

function stripExtension(filePath: string): string {
  return filePath.replace(/\.[^/.]+$/, '');
}

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}
