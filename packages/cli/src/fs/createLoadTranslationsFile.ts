import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import chalk from 'chalk';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { DEFAULT_TRANSLATIONS_DIR } from '../utils/constants.js';
import { publishNewFile } from './publishNewFile.js';

function toRelativeImportPath(relativePath: string) {
  const normalizedPath = relativePath.split(path.sep).join(path.posix.sep);

  if (!normalizedPath) {
    return './';
  }

  // Dynamic imports must use explicit relative specifiers; values like
  // "src/_gt" are otherwise treated as package names by Vite and Node.
  const hasExplicitRelativePrefix =
    normalizedPath === '..' ||
    normalizedPath.startsWith('../') ||
    normalizedPath.startsWith('./');

  return hasExplicitRelativePrefix
    ? `${normalizedPath}/`
    : `./${normalizedPath}/`;
}

export async function createLoadTranslationsFile(
  appDirectory: string,
  translationsDir: string = DEFAULT_TRANSLATIONS_DIR,
  locales: string[]
): Promise<string> {
  const realProjectRoot = requireRealDirectory(appDirectory);
  const srcDirectory = path.join(appDirectory, 'src');
  const srcStat = tryLstat(srcDirectory);
  if (srcStat?.isSymbolicLink()) {
    throw unsafeLoaderPathError(
      'The source directory for the translation loader is a symbolic link'
    );
  }
  if (srcStat && !srcStat.isDirectory()) {
    throw unsafeLoaderPathError(
      'The source path for the translation loader is not a directory'
    );
  }
  const usingSrcDirectory = srcStat?.isDirectory() ?? false;

  const loadTranslationsDir = usingSrcDirectory ? srcDirectory : appDirectory;
  requireWithinProject(realProjectRoot, fs.realpathSync(loadTranslationsDir));
  const resolvedTranslationsDir = path.resolve(appDirectory, translationsDir);
  requireLexicallyWithinProject(appDirectory, resolvedTranslationsDir);
  rejectLinkedPathSegments(appDirectory, resolvedTranslationsDir);
  const relativePath = path.relative(
    loadTranslationsDir,
    resolvedTranslationsDir
  );
  const publicPath = toRelativeImportPath(relativePath);

  const filePath = usingSrcDirectory
    ? path.join(srcDirectory, 'loadTranslations.js')
    : path.join(appDirectory, 'loadTranslations.js');
  const loaderStat = tryLstat(filePath);
  if (loaderStat?.isSymbolicLink()) {
    throw unsafeLoaderPathError(
      'The translation loader file is a symbolic link'
    );
  }
  if (loaderStat && !loaderStat.isFile()) {
    throw unsafeLoaderPathError('The translation loader path is not a file');
  }

  if (!loaderStat) {
    await fs.promises.mkdir(resolvedTranslationsDir, { recursive: true });
    requireWithinProject(
      realProjectRoot,
      fs.realpathSync(resolvedTranslationsDir)
    );
    const localeFiles = locales.map((locale) => ({
      file: path.join(resolvedTranslationsDir, `${locale}.json`),
      locale,
    }));
    for (const { file, locale } of localeFiles) {
      const localeStat = tryLstat(file);
      if (localeStat?.isSymbolicLink()) {
        throw unsafeLoaderPathError(
          `The ${locale} translation catalog is a symbolic link`
        );
      }
      if (localeStat && !localeStat.isFile()) {
        throw unsafeLoaderPathError(
          `The ${locale} translation catalog path is not a file`
        );
      }
    }

    const loadTranslationsContent = `
export default async function loadTranslations(locale) {
  try {
    // Load translations from ${translationsDir} directory
    // This matches the GT config files.gt.output path
    const t = await import(\`${publicPath}\${locale}.json\`);
    return t.default;
  } catch (error) {
    console.warn(\`Failed to load translations for locale \${locale}:\`, error);
    return {};
  }
}
`;
    const loaderCreated = await publishNewFile(
      filePath,
      loadTranslationsContent,
      () => requireRegularGeneratedFile(filePath, 'translation loader')
    );
    logger.info(
      loaderCreated
        ? `Created ${chalk.cyan(
            'loadTranslations.js'
          )} file at ${chalk.cyan(filePath)}.`
        : `Found ${chalk.cyan('loadTranslations.js')} file at ${chalk.cyan(
            filePath
          )}. Skipping creation...`
    );
    for (const { file, locale } of localeFiles) {
      const currentStat = tryLstat(file);
      if (currentStat) {
        requireRegularGeneratedFile(file, `${locale} translation catalog`);
        continue;
      }
      await publishNewFile(file, '{}', () =>
        requireRegularGeneratedFile(file, `${locale} translation catalog`)
      );
    }
  } else {
    logger.info(
      `Found ${chalk.cyan('loadTranslations.js')} file at ${chalk.cyan(
        filePath
      )}. Skipping creation...`
    );
  }

  return filePath;
}

function requireRegularGeneratedFile(filepath: string, label: string): void {
  const stat = tryLstat(filepath);
  if (stat?.isSymbolicLink()) {
    throw unsafeLoaderPathError(`The ${label} is a symbolic link`);
  }
  if (!stat?.isFile()) {
    throw unsafeLoaderPathError(`The ${label} path is not a file`);
  }
}

function tryLstat(filepath: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(filepath);
  } catch {
    return undefined;
  }
}

function requireRealDirectory(filepath: string): string {
  try {
    const realPath = fs.realpathSync(filepath);
    if (!fs.statSync(realPath).isDirectory()) throw new Error();
    return realPath;
  } catch {
    throw unsafeLoaderPathError(
      'The project root for the translation loader is not a safe directory'
    );
  }
}

function requireLexicallyWithinProject(root: string, candidate: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw unsafeLoaderPathError(
      'The translations directory is outside the project root'
    );
  }
}

function requireWithinProject(realRoot: string, candidate: string): void {
  const relative = path.relative(realRoot, candidate);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw unsafeLoaderPathError(
      'The translation loader path resolves outside the project root'
    );
  }
}

function rejectLinkedPathSegments(root: string, candidate: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  let current = path.resolve(root);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = tryLstat(current);
    if (stat?.isSymbolicLink()) {
      throw unsafeLoaderPathError(
        'The translations directory contains a symbolic-link path'
      );
    }
    if (!stat) return;
  }
}

function unsafeLoaderPathError(whatHappened: string): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened,
      fix: 'Use real loader and catalog directories inside the project root, then run setup again',
    })
  );
}
