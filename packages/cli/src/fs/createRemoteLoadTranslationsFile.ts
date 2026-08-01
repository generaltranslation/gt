import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import {
  createDiagnosticMessage,
  defaultCacheUrl,
} from 'generaltranslation/internal';
import { logger } from '../console/logger.js';

/**
 * Creates the lightweight CDN loader expected by `gt-vue`'s `createGT()`.
 *
 * Vite exposes the project identifier through `VITE_GT_PROJECT_ID`. The
 * generated loader intentionally uses the unpinned CDN route so newly
 * published catalogs can be consumed without regenerating application code.
 * Existing loader files are never overwritten.
 *
 * @param appDirectory - Vue application root.
 * @returns The absolute loader path, whether newly created or pre-existing.
 */
export async function createRemoteLoadTranslationsFile(
  appDirectory: string
): Promise<string> {
  const usingSrcDirectory = fs.existsSync(path.join(appDirectory, 'src'));
  const filePath = usingSrcDirectory
    ? path.join(appDirectory, 'src', 'loadTranslations.js')
    : path.join(appDirectory, 'loadTranslations.js');

  if (fs.existsSync(filePath)) {
    logger.info(
      `Found ${chalk.cyan('loadTranslations.js')} file at ${chalk.cyan(
        filePath
      )}. Skipping creation...`
    );
    return filePath;
  }

  const missingProjectIdError = createDiagnosticMessage({
    source: 'gt-vue',
    severity: 'Error',
    whatHappened: 'The CDN loader could not find a Vite project ID',
    fix: 'Set VITE_GT_PROJECT_ID in the application environment',
  });
  const requestFailedError = createDiagnosticMessage({
    source: 'gt-vue',
    severity: 'Error',
    whatHappened: 'The translation catalog could not be loaded from the CDN',
    fix: 'Check the project ID, locale, publication status, and network connection',
  });
  const content = `
const cacheUrl = ${JSON.stringify(defaultCacheUrl)};
const missingProjectIdError = ${JSON.stringify(missingProjectIdError)};
const requestFailedError = ${JSON.stringify(requestFailedError)};

export default async function loadTranslations(locale) {
  const projectId = import.meta.env.VITE_GT_PROJECT_ID;
  if (!projectId) {
    throw new Error(missingProjectIdError);
  }

  const url = \`\${cacheUrl}/\${projectId}/\${encodeURIComponent(locale)}\`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(requestFailedError);
  }
  return response.json();
}
`;

  await fs.promises.writeFile(filePath, content);
  logger.info(
    `Created ${chalk.cyan('loadTranslations.js')} file at ${chalk.cyan(
      filePath
    )}.`
  );
  return filePath;
}
