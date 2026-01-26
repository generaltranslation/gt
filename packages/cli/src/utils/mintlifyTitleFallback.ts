import path from 'path';
import YAML from 'yaml';

type TitleFallbackResult = {
  content: string;
  addedTitle: boolean;
};

const FRONTMATTER_REGEX =
  /^---\s*\r?\n([\s\S]*?)\r?\n(---|\.\.\.)\s*(?:\r?\n|$)/;

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => {
      if (!word) return '';
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function deriveTitleFromFilename(
  fileName: string,
  defaultLocale?: string
): string {
  const base = path.basename(fileName, path.extname(fileName));
  if (base.toLowerCase() === 'index') {
    const parentDir = path.dirname(fileName);
    if (parentDir === '.' || parentDir === path.sep) {
      return 'Index';
    }
    const parent = path.basename(parentDir);
    if (parent && defaultLocale && parent === defaultLocale) {
      return 'Index';
    }
    if (parent) {
      return toTitleCase(parent.replace(/[-_]+/g, ' ').trim());
    }
    return 'Index';
  }
  const normalized = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return base;
  }
  return toTitleCase(normalized);
}

function hasMeaningfulTitle(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}

export function applyMintlifyTitleFallback(
  content: string,
  fileName: string,
  defaultLocale?: string
): TitleFallbackResult {
  const inferredTitle = deriveTitleFromFilename(fileName, defaultLocale);
  if (!inferredTitle) {
    return { content, addedTitle: false };
  }

  const hasBom = content.startsWith('\uFEFF');
  const contentBody = hasBom ? content.slice(1) : content;
  const newline = contentBody.includes('\r\n') ? '\r\n' : '\n';

  const frontmatterMatch = contentBody.match(FRONTMATTER_REGEX);
  if (frontmatterMatch) {
    const frontmatterContent = frontmatterMatch[1];
    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = YAML.parse(frontmatterContent);
    } catch {
      return { content, addedTitle: false };
    }

    if (parsed && hasMeaningfulTitle(parsed.title)) {
      return { content, addedTitle: false };
    }

    const titleLine = YAML.stringify({ title: inferredTitle }).trimEnd();
    const headerEndIndex = contentBody.indexOf(newline) + newline.length;
    const updated =
      contentBody.slice(0, headerEndIndex) +
      titleLine +
      newline +
      contentBody.slice(headerEndIndex);

    return { content: (hasBom ? '\uFEFF' : '') + updated, addedTitle: true };
  }

  const titleLine = YAML.stringify({ title: inferredTitle }).trimEnd();
  const frontmatterBlock = `---${newline}${titleLine}${newline}---${newline}${newline}`;
  return {
    content: (hasBom ? '\uFEFF' : '') + frontmatterBlock + contentBody,
    addedTitle: true,
  };
}
