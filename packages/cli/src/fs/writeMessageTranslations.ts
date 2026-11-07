import fs from 'node:fs';
import type { Settings } from '../types/index.js';
import { getMessageHashes } from '../state/messageHashes.js';
import { resolveLocaleFiles } from './config/parseFilesConfig.js';
import { saveJSON } from './saveJSON.js';
import { logger } from '../console/logger.js';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';

/**
 * Write `files.gt.msgOutput` for each locale: a copy of the locale's
 * translations file that keeps only entries extracted from msg() and
 * useMessages()/getMessages(). Reads the translations file from disk, so it
 * also covers locales whose download was skipped because nothing changed.
 */
export async function writeMessageTranslations(
  settings: Settings
): Promise<void> {
  const msgOutput = settings.files.gtJson.msgOutput;
  const gtOutput = settings.files.placeholderPaths.gt;
  const messageHashes = getMessageHashes();
  if (!msgOutput || !gtOutput || !messageHashes) return;

  for (const locale of settings.locales) {
    const translationsPath = resolveLocaleFiles({ gt: gtOutput }, locale).gt;
    const messagesPath = resolveLocaleFiles({ gt: msgOutput }, locale).gt;
    if (!translationsPath || !messagesPath) continue;
    if (!fs.existsSync(translationsPath)) continue;

    let translations: Record<string, unknown>;
    try {
      translations = JSON.parse(
        await fs.promises.readFile(translationsPath, 'utf8')
      );
    } catch (error) {
      logger.warn(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Warning',
          whatHappened: `Could not write ${messagesPath}`,
          why: `${translationsPath} is not valid JSON`,
          details: formatDiagnosticErrorDetails(error),
        })
      );
      continue;
    }

    const messages: Record<string, unknown> = {};
    for (const hash of Object.keys(translations).sort()) {
      if (messageHashes.has(hash)) messages[hash] = translations[hash];
    }
    await saveJSON(messagesPath, messages);
  }
}
