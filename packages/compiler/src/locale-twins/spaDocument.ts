/**
 * Rewrites a built SPA document (Vite's `index.html`) so the browser loads
 * the twins of its locale: the entry `<script type="module">` and the
 * modulepreloads of twinned files are replaced by the locale twin data block
 * and bootstrap (`gt-i18n/internal/locale-twins`). Shared files stay
 * referenced as built. Pure: no file system.
 */
import path from 'node:path';
import type { LocaleTwinManifest } from 'generaltranslation/internal';
import type { CustomMapping } from 'generaltranslation/types';
import { defaultEnableI18nCookieName } from 'gt-i18n/internal/cookies';
import {
  createLocaleTwinDocumentMarkup,
  LOCALE_TWIN_DOCUMENT_VERSION,
  type LocaleTwinDocumentTag,
} from 'gt-i18n/internal/locale-twins';

export type RewriteLocaleTwinDocumentInput = {
  html: string;
  manifest: LocaleTwinManifest;
  localeCookieName: string;
  /** Enable-i18n cookie name (default: the canonical GT enable-i18n cookie). */
  enableI18nCookieName?: string;
  /**
   * `gt.config.json` `customMapping`: the bootstrap matches browser languages
   * to custom locale aliases through their codes.
   */
  customMapping?: CustomMapping;
  /**
   * Load the bootstrap from a file named `fileName`, written next to the
   * entry chunk, instead of inlining it.
   */
  externalBootstrap?: { fileName: string };
};

export type RewriteLocaleTwinDocumentResult = {
  html: string;
  /** outDir-relative path of the external bootstrap, when requested. */
  bootstrapFile?: string;
};

type TwinnedTag = {
  start: number;
  end: number;
  tag: 'script' | 'link';
  attributes: Record<string, string>;
  url: string;
  fileName: string;
};

// A start tag's attributes: quoted values may contain `>`.
const ATTRIBUTES = `(?:[^>"']|"[^"]*"|'[^']*')*`;
// HTML end tags allow whitespace and (ignored) attributes before `>`, in any
// case: `</script >`, `</SCRIPT\n>`, `</script foo>`.
const TAG_PATTERN = new RegExp(
  `<script\\b(${ATTRIBUTES})>\\s*</script\\b[^>]*>|<link\\b(${ATTRIBUTES}?)/?>`,
  'gi'
);
const ATTRIBUTE_PATTERN =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
// `--!>` also ends a comment, and an unclosed comment runs to the end.
const COMMENT_PATTERN = /<!--[\s\S]*?(?:--!?>|$)/g;

/**
 * Returns the rewritten document, or `undefined` when it references no
 * twinned file (nothing to select per locale).
 */
export function rewriteLocaleTwinDocument(
  input: RewriteLocaleTwinDocumentInput
): RewriteLocaleTwinDocumentResult | undefined {
  const { html, manifest } = input;
  const tags = findTwinnedTags(html, manifest.twinned);
  if (tags.length === 0) return undefined;

  const entryTag = tags.find((tag) => tag.tag === 'script') ?? tags[0];
  // A nonce-based CSP (Vite `html.cspNonce`) must allow the bootstrap too
  const bootstrap: { src?: string; nonce?: string } = {
    nonce: entryTag.attributes.nonce,
  };
  let bootstrapFile: string | undefined;
  if (input.externalBootstrap) {
    const { fileName } = input.externalBootstrap;
    bootstrap.src = replaceUrlBasename(entryTag.url, fileName);
    bootstrapFile = path.posix.join(
      path.posix.dirname(entryTag.fileName),
      fileName
    );
  }
  const markup = createLocaleTwinDocumentMarkup(
    {
      version: LOCALE_TWIN_DOCUMENT_VERSION,
      defaultLocale: manifest.defaultLocale,
      locales: manifest.locales,
      localeCookieName: input.localeCookieName,
      enableI18nCookieName:
        input.enableI18nCookieName ?? defaultEnableI18nCookieName,
      ...(input.customMapping && {
        customMapping: pickCustomLocaleCodes(input.customMapping),
      }),
      tags: tags.map(
        (tag): LocaleTwinDocumentTag => ({
          tag: tag.tag,
          attributes: tag.attributes,
          urls: Object.fromEntries(
            manifest.locales.map((locale) => [
              locale,
              replaceUrlBasename(
                tag.url,
                path.posix.basename(manifest.twins[locale][tag.fileName])
              ),
            ])
          ),
        })
      ),
    },
    bootstrap
  );

  // Replace the first tag with the markup and drop the others, from the end
  let output = html;
  for (const tag of [...tags].reverse()) {
    if (tag === tags[0]) {
      output = output.slice(0, tag.start) + markup + output.slice(tag.end);
    } else {
      const [start, end] = expandToLine(output, tag.start, tag.end);
      output = output.slice(0, start) + output.slice(end);
    }
  }
  return { html: output, bootstrapFile };
}

/** The custom locale aliases that map to a code (all the bootstrap reads). */
function pickCustomLocaleCodes(customMapping: CustomMapping): CustomMapping {
  const codes: CustomMapping = {};
  for (const [locale, mapping] of Object.entries(customMapping)) {
    if (typeof mapping === 'object' && mapping?.code) {
      codes[locale] = { code: mapping.code };
    }
  }
  return codes;
}

function findTwinnedTags(html: string, twinned: string[]): TwinnedTag[] {
  const comments = [...html.matchAll(COMMENT_PATTERN)].map(
    (match) => [match.index, match.index + match[0].length] as const
  );
  const inComment = (index: number) =>
    comments.some(([start, end]) => index >= start && index < end);

  const tags: TwinnedTag[] = [];
  for (const match of html.matchAll(TAG_PATTERN)) {
    if (inComment(match.index)) continue;
    const isScript = match[1] !== undefined;
    const attributes = parseAttributes(isScript ? match[1] : match[2]);
    const urlAttribute = isScript ? 'src' : 'href';
    const url = attributes[urlAttribute];
    if (url === undefined) continue;
    if (isScript && attributes.type !== 'module') continue;
    if (
      !isScript &&
      !(attributes.rel ?? '')
        .toLowerCase()
        .split(/\s+/)
        .includes('modulepreload')
    ) {
      continue;
    }
    const fileName = findTwinnedFile(url, twinned);
    if (fileName === undefined) continue;
    delete attributes[urlAttribute];
    tags.push({
      start: match.index,
      end: match.index + match[0].length,
      tag: isScript ? 'script' : 'link',
      attributes,
      url,
      fileName,
    });
  }
  return tags;
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1].toLowerCase();
    if (name in attributes) continue;
    attributes[name] = decodeHtmlEntities(
      match[2] ?? match[3] ?? match[4] ?? ''
    );
  }
  return attributes;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(amp|quot|apos|lt|gt|#39);/g,
    (_entity, name: string) =>
      ({ amp: '&', quot: '"', apos: "'", '#39': "'", lt: '<', gt: '>' })[
        name
      ] ?? ''
  );
}

/** URL path without query, hash or origin. */
function urlPath(url: string): string {
  const withoutSuffix = url.replace(/[?#].*$/, '');
  const withoutOrigin = withoutSuffix.replace(
    /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/]*/i,
    ''
  );
  try {
    return decodeURI(withoutOrigin);
  } catch {
    return withoutOrigin;
  }
}

/** The twinned file a URL names: the longest file name that ends its path. */
function findTwinnedFile(url: string, twinned: string[]): string | undefined {
  const pathname = urlPath(url).replace(/^\.\//, '');
  let found: string | undefined;
  for (const fileName of twinned) {
    if (pathname !== fileName && !pathname.endsWith(`/${fileName}`)) continue;
    if (found === undefined || fileName.length > found.length) found = fileName;
  }
  return found;
}

/** Replaces the last path segment of a URL, keeping its query and hash. */
function replaceUrlBasename(url: string, basename: string): string {
  const suffixStart = url.search(/[?#]/);
  const base = suffixStart === -1 ? url : url.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : url.slice(suffixStart);
  return base.slice(0, base.lastIndexOf('/') + 1) + basename + suffix;
}

/** Widens a removed tag to its whole line when it is alone on it. */
function expandToLine(
  html: string,
  start: number,
  end: number
): [number, number] {
  let lineStart = start;
  while (lineStart > 0 && /[ \t]/.test(html[lineStart - 1])) lineStart--;
  let lineEnd = end;
  while (lineEnd < html.length && /[ \t]/.test(html[lineEnd])) lineEnd++;
  const startsLine = lineStart === 0 || html[lineStart - 1] === '\n';
  if (!startsLine) return [start, end];
  if (html.startsWith('\r\n', lineEnd)) return [lineStart, lineEnd + 2];
  if (html[lineEnd] === '\n') return [lineStart, lineEnd + 1];
  return [start, end];
}
