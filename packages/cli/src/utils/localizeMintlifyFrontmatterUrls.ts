import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import YAML, { isMap, isScalar } from 'yaml';
import type { Content, Root, Yaml } from 'mdast';
import { createFileMapping } from '../formats/files/fileMapping.js';
import type { Settings } from '../types/index.js';

const SKIPPABLE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\.\/|\.\.\/)/i;

function getYamlFrontmatter(content: string): Yaml | null {
  let tree: Root;
  try {
    tree = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .parse(content) as Root;
  } catch {
    return null;
  }

  const yamlNode = (tree.children as Content[]).find(
    (node): node is Yaml => (node as Yaml).type === 'yaml'
  );
  if (
    !yamlNode ||
    !yamlNode.position ||
    yamlNode.position.start?.offset === undefined ||
    yamlNode.position.end?.offset === undefined
  ) {
    return null;
  }
  return yamlNode;
}

function normalizeMintlifyFrontmatterUrl(
  url: string,
  targetLocale: string,
  knownLocales: Set<string>
): string | null {
  const trimmed = url.trim();
  if (!trimmed || SKIPPABLE_URL_REGEX.test(trimmed)) {
    return null;
  }

  const leadingWhitespace = url.match(/^\s*/)?.[0] ?? '';
  const trailingWhitespace = url.match(/\s*$/)?.[0] ?? '';
  const pathBody = trimmed.replace(/^\/+/, '');
  const [firstSegment, ...restSegments] = pathBody.split('/');

  if (firstSegment === targetLocale) {
    const normalized = `${leadingWhitespace}${pathBody}${trailingWhitespace}`;
    return normalized === url ? null : normalized;
  }

  const unprefixedPath = knownLocales.has(firstSegment)
    ? restSegments.join('/')
    : pathBody;
  const localizedPath = unprefixedPath
    ? `${targetLocale}/${unprefixedPath}`
    : `${targetLocale}/`;
  const normalized = `${leadingWhitespace}${localizedPath}${trailingWhitespace}`;

  return normalized === url ? null : normalized;
}

export function localizeMintlifyFrontmatterUrlForContent(
  content: string,
  targetLocale: string,
  knownLocaleValues: string[]
): { content: string; changed: boolean } {
  const yamlNode = getYamlFrontmatter(content);
  if (!yamlNode) {
    return { content, changed: false };
  }

  const frontmatterRaw: string = yamlNode.value || '';
  const doc = YAML.parseDocument(frontmatterRaw, {
    prettyErrors: false,
    keepSourceTokens: true,
  });
  if (doc.errors?.length || !isMap(doc.contents)) {
    return { content, changed: false };
  }

  const urlNode = doc.get('url', true);
  if (!isScalar(urlNode) || typeof urlNode.value !== 'string') {
    return { content, changed: false };
  }

  const localizedUrl = normalizeMintlifyFrontmatterUrl(
    urlNode.value,
    targetLocale,
    new Set(knownLocaleValues)
  );
  if (!localizedUrl) {
    return { content, changed: false };
  }

  urlNode.value = localizedUrl;

  const start = yamlNode.position!.start.offset as number;
  const end = yamlNode.position!.end.offset as number;
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const frontmatter = doc.toString().trimEnd().replace(/\n/g, newline);
  return {
    content: `${content.slice(0, start)}---${newline}${frontmatter}${newline}---${content.slice(end)}`,
    changed: true,
  };
}

function shouldProcessFile(filePath: string, includeFiles?: Set<string>) {
  if (!includeFiles) return true;
  return includeFiles.has(filePath) || includeFiles.has(path.resolve(filePath));
}

export default async function localizeMintlifyFrontmatterUrls(
  settings: Settings,
  includeFiles?: Set<string>
) {
  if (settings.framework !== 'mintlify' || !settings.files) return;

  const fileMapping = createFileMapping(
    settings.files.resolvedPaths,
    settings.files.placeholderPaths,
    settings.files.transformPaths ?? {},
    settings.files.transformFormats ?? {},
    settings.locales,
    settings.defaultLocale
  );
  const knownLocaleValues = [settings.defaultLocale, ...settings.locales];

  for (const [locale, filesMap] of Object.entries(fileMapping)) {
    const targetFiles = Object.values(filesMap).filter(
      (filePath) =>
        (filePath.endsWith('.md') || filePath.endsWith('.mdx')) &&
        shouldProcessFile(filePath, includeFiles)
    );

    await Promise.all(
      targetFiles.map(async (filePath) => {
        if (!fs.existsSync(filePath)) return;

        const content = await fs.promises.readFile(filePath, 'utf8');
        const result = localizeMintlifyFrontmatterUrlForContent(
          content,
          locale,
          knownLocaleValues
        );
        if (result.changed) {
          await fs.promises.writeFile(filePath, result.content, 'utf8');
        }
      })
    );
  }
}
