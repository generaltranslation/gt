/**
 * The locale twin SPA document contract, shared by the build (which writes it
 * into `index.html`) and the readers: the browser bootstrap and the server
 * helper. Edge-safe: no Node APIs.
 */
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import { LOCALE_TWIN_BOOTSTRAP_SCRIPT } from './bootstrap';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  LOCALE_TWIN_BOOTSTRAP_ATTRIBUTE,
  LOCALE_TWIN_DOCUMENT_DATA_ID,
  LOCALE_TWIN_DOCUMENT_VERSION,
} from './documentConstants';

export {
  LOCALE_TWIN_BOOTSTRAP_ATTRIBUTE,
  LOCALE_TWIN_DOCUMENT_DATA_ID,
  LOCALE_TWIN_DOCUMENT_VERSION,
};

/**
 * A tag of the built document that names a twinned file. It is written per
 * locale: `urls[locale]` goes in `src` (script) or `href` (link).
 */
export type LocaleTwinDocumentTag = {
  tag: 'script' | 'link';
  /** The tag's other attributes, as built (`''` for a bare attribute). */
  attributes: Record<string, string>;
  /** URL of the file's twin for each locale. */
  urls: Record<string, string>;
};

/** Contents of the locale twin data block (`#gt-locale-twins-data`). */
export type LocaleTwinDocumentData = {
  version: typeof LOCALE_TWIN_DOCUMENT_VERSION;
  defaultLocale: string;
  /** Every locale with twins, including the default. */
  locales: string[];
  /** Cookie that holds the user's locale. */
  localeCookieName: string;
  /** In document order: the entry script first, then its modulepreloads. */
  tags: LocaleTwinDocumentTag[];
};

/**
 * The markup that replaces a built document's entry script: the JSON data
 * block followed by the bootstrap, inline by default or loaded from
 * `bootstrap.src`. The inline bootstrap's text is exactly
 * {@link LOCALE_TWIN_BOOTSTRAP_SCRIPT} (for CSP hashes).
 */
export function createLocaleTwinDocumentMarkup(
  data: LocaleTwinDocumentData,
  bootstrap?: { src: string }
): string {
  // `<` is escaped so the JSON can never close the script element
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const dataBlock = `<script type="application/json" id="${LOCALE_TWIN_DOCUMENT_DATA_ID}">${json}</script>`;
  const script = bootstrap
    ? `<script ${LOCALE_TWIN_BOOTSTRAP_ATTRIBUTE} src="${escapeHtmlAttribute(bootstrap.src)}"></script>`
    : `<script ${LOCALE_TWIN_BOOTSTRAP_ATTRIBUTE}>${LOCALE_TWIN_BOOTSTRAP_SCRIPT}</script>`;
  return dataBlock + script;
}

/** A locale twin document split around its data block and bootstrap. */
export type ParsedLocaleTwinDocument = {
  data: LocaleTwinDocumentData;
  /** The HTML before the data block. */
  before: string;
  /** The HTML between the data block and the bootstrap (usually empty). */
  between: string;
  /** The HTML after the bootstrap. */
  after: string;
};

// HTML end tags allow whitespace and (ignored) attributes before `>`.
const DATA_BLOCK_PATTERN = new RegExp(
  `<script\\b[^>]*\\bid=["']?${LOCALE_TWIN_DOCUMENT_DATA_ID}["']?[^>]*>([\\s\\S]*?)</script\\b[^>]*>`,
  'i'
);
const BOOTSTRAP_PATTERN = new RegExp(
  `<script\\b[^>]*\\b${LOCALE_TWIN_BOOTSTRAP_ATTRIBUTE}\\b[^>]*>[\\s\\S]*?</script\\b[^>]*>`,
  'i'
);

/**
 * Finds the data block and bootstrap of a built locale twin document.
 * Throws a diagnostic error when the document has no data block or its
 * version is unknown.
 */
export function parseLocaleTwinDocument(
  html: string
): ParsedLocaleTwinDocument {
  const dataMatch = DATA_BLOCK_PATTERN.exec(html);
  if (!dataMatch) throw new Error(MISSING_LOCALE_TWIN_DOCUMENT_DATA);
  const data = parseLocaleTwinDocumentData(dataMatch[1]);
  const before = html.slice(0, dataMatch.index);
  const rest = html.slice(dataMatch.index + dataMatch[0].length);
  const bootstrapMatch = BOOTSTRAP_PATTERN.exec(rest);
  if (!bootstrapMatch) return { data, before, between: rest, after: '' };
  return {
    data,
    before,
    between: rest.slice(0, bootstrapMatch.index),
    after: rest.slice(bootstrapMatch.index + bootstrapMatch[0].length),
  };
}

function parseLocaleTwinDocumentData(json: string): LocaleTwinDocumentData {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new Error(
      createInvalidLocaleTwinDocumentDataMessage(
        formatDiagnosticErrorDetails(error)
      )
    );
  }
  const data = value as Partial<LocaleTwinDocumentData> | null;
  if (data?.version !== LOCALE_TWIN_DOCUMENT_VERSION) {
    throw new Error(
      createUnsupportedLocaleTwinDocumentVersionMessage(data?.version)
    );
  }
  if (
    typeof data.defaultLocale !== 'string' ||
    !Array.isArray(data.locales) ||
    typeof data.localeCookieName !== 'string' ||
    !Array.isArray(data.tags)
  ) {
    throw new Error(
      createInvalidLocaleTwinDocumentDataMessage([
        'Expected defaultLocale, locales, localeCookieName and tags',
      ])
    );
  }
  return data as LocaleTwinDocumentData;
}

/** Escapes a value for a double-quoted HTML attribute. */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const REBUILD_FIX =
  "Serve the index.html written by `vite build` with the 'locale-twins' translation splitting strategy";

const MISSING_LOCALE_TWIN_DOCUMENT_DATA = createGtI18nDiagnostic({
  severity: 'Error',
  whatHappened: 'The document has no locale twin data',
  why: `it has no <script id="${LOCALE_TWIN_DOCUMENT_DATA_ID}"> block`,
  fix: REBUILD_FIX,
});

function createUnsupportedLocaleTwinDocumentVersionMessage(
  version: unknown
): string {
  return createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened: `The document has an unsupported locale twin document version ${String(version)}`,
    why: `this version of gt-i18n reads version ${LOCALE_TWIN_DOCUMENT_VERSION}`,
    fix: 'Build the app with the same General Translation release that serves it',
  });
}

function createInvalidLocaleTwinDocumentDataMessage(
  details: string | string[] | undefined
): string {
  return createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened: 'The document has invalid locale twin data',
    fix: REBUILD_FIX,
    details,
  });
}
