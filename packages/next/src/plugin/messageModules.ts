import fs from 'fs';
import path from 'path';

/**
 * Experimental: one ES module per embedded message, `<dir>/<hash>.js`, which
 * the SWC plugin imports at each call site so bundlers ship only the
 * translations a chunk uses.
 */

const MODULE_EXTENSION = '.js';
const TEMP_SUFFIX = '.tmp';
const STALE_TEMP_MS = 60 * 60 * 1000;

/** (locale, translation) pairs for one message, in embedded locale order */
export type MessageTranslations = ReadonlyArray<readonly [string, unknown]>;

/**
 * Hashes that are safe as file names. Must match the SWC plugin's
 * `is_module_hash`.
 */
export function isMessageModuleHash(hash: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(hash);
}

/**
 * Module source for a message:
 * `export default (locale) => locale === "fr" ? … : undefined;`, the
 * callback otherwise embedded at each call site.
 */
export function renderMessageModule(translations: MessageTranslations): string {
  const body = translations.reduceRight(
    (alternate, [locale, translation]) =>
      `locale === ${JSON.stringify(locale)} ? ${JSON.stringify(translation)} : ${alternate}`,
    'undefined'
  );
  return `export default (locale) => ${body};\n`;
}

/**
 * Group the embedded locales' translations by hash, keeping only hashes with a
 * translation that can be a module.
 */
export function collectMessageTranslations(
  locales: ReadonlyArray<{
    locale: string;
    translations: Record<string, unknown>;
  }>
): Map<string, [string, unknown][]> {
  const messages = new Map<string, [string, unknown][]>();
  for (const { locale, translations } of locales) {
    for (const [hash, translation] of Object.entries(translations)) {
      if (translation == null || !isMessageModuleHash(hash)) continue;
      let entries = messages.get(hash);
      if (!entries) messages.set(hash, (entries = []));
      entries.push([locale, translation]);
    }
  }
  return messages;
}

/**
 * Write a module per message into `dir`, rewriting only files whose content
 * changed, and delete modules for messages that no longer have one. Other
 * files in `dir` are left alone.
 */
export function writeMessageModules(
  dir: string,
  messages: ReadonlyMap<string, MessageTranslations>
): { written: number; removed: number } {
  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const [hash, translations] of Array.from(messages)) {
    const filePath = path.join(dir, `${hash}${MODULE_EXTENSION}`);
    const source = renderMessageModule(translations);
    if (readFileIfExists(filePath) === source) continue;
    writeFileAtomic(filePath, source);
    written++;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    if (entry.endsWith(TEMP_SUFFIX)) {
      const stat = fs.statSync(filePath, { throwIfNoEntry: false });
      if (stat && Date.now() - stat.mtimeMs >= STALE_TEMP_MS) {
        fs.rmSync(filePath, { force: true });
      }
      continue;
    }
    if (!entry.endsWith(MODULE_EXTENSION)) continue;
    const hash = entry.slice(0, -MODULE_EXTENSION.length);
    if (!isMessageModuleHash(hash) || messages.has(hash)) continue;
    fs.rmSync(filePath, { force: true });
    removed++;
  }
  return { written, removed };
}

function readFileIfExists(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Next.js loads the config in several processes, so a module is written to a
 * temp file and renamed into place: readers only ever see a complete file.
 */
function writeFileAtomic(filePath: string, source: string): void {
  const temp = `${filePath}.${process.pid}${TEMP_SUFFIX}`;
  fs.writeFileSync(temp, source);
  try {
    fs.renameSync(temp, filePath);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}
