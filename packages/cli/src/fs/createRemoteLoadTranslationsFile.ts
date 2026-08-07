import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import {
  createDiagnosticMessage,
  defaultCacheUrl,
} from 'generaltranslation/internal';
import { logger } from '../console/logger.js';
import { publishNewFile } from './publishNewFile.js';

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
  const realProjectRoot = requireRealDirectory(appDirectory);
  const srcDirectory = path.join(appDirectory, 'src');
  const srcStat = tryLstat(srcDirectory);
  if (srcStat?.isSymbolicLink()) {
    throw unsafeRemoteLoaderPathError(
      'The source directory for the CDN loader is a symbolic link'
    );
  }
  if (srcStat && !srcStat.isDirectory()) {
    throw unsafeRemoteLoaderPathError(
      'The source path for the CDN loader is not a directory'
    );
  }
  const usingSrcDirectory = srcStat?.isDirectory() ?? false;
  const loaderDirectory = usingSrcDirectory ? srcDirectory : appDirectory;
  requireWithinProject(realProjectRoot, fs.realpathSync(loaderDirectory));
  const filePath = usingSrcDirectory
    ? path.join(srcDirectory, 'loadTranslations.js')
    : path.join(appDirectory, 'loadTranslations.js');
  const loaderStat = tryLstat(filePath);

  if (loaderStat?.isSymbolicLink()) {
    throw unsafeRemoteLoaderPathError(
      'The CDN translation loader file is a symbolic link'
    );
  }
  if (loaderStat && !loaderStat.isFile()) {
    throw unsafeRemoteLoaderPathError(
      'The CDN translation loader path is not a file'
    );
  }

  if (loaderStat) {
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

  const created = await publishNewFile(filePath, content, () =>
    requireSafeExistingLoader(filePath)
  );
  logger.info(
    created
      ? `Created ${chalk.cyan('loadTranslations.js')} file at ${chalk.cyan(
          filePath
        )}.`
      : `Found ${chalk.cyan('loadTranslations.js')} file at ${chalk.cyan(
          filePath
        )}. Skipping creation...`
  );
  return filePath;
}

function tryLstat(filepath: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(filepath);
  } catch {
    return undefined;
  }
}

function requireSafeExistingLoader(filePath: string): void {
  const stat = tryLstat(filePath);
  if (stat?.isSymbolicLink()) {
    throw unsafeRemoteLoaderPathError(
      'The CDN translation loader file is a symbolic link'
    );
  }
  if (!stat?.isFile()) {
    throw unsafeRemoteLoaderPathError(
      'The CDN translation loader path is not a file'
    );
  }
}

function requireRealDirectory(filepath: string): string {
  try {
    const realPath = fs.realpathSync(filepath);
    if (!fs.statSync(realPath).isDirectory()) throw new Error();
    return realPath;
  } catch {
    throw unsafeRemoteLoaderPathError(
      'The project root for the CDN loader is not a safe directory'
    );
  }
}

function requireWithinProject(
  realProjectRoot: string,
  candidate: string
): void {
  const relativePath = path.relative(realProjectRoot, candidate);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw unsafeRemoteLoaderPathError(
      'The CDN translation loader path resolves outside the project root'
    );
  }
}

function unsafeRemoteLoaderPathError(whatHappened: string): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened,
      fix: 'Use a real source directory and loader file inside the project, then run setup again',
    })
  );
}
