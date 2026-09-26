import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import chalk from 'chalk';
import { DEFAULT_TRANSLATIONS_DIR } from '../utils/constants.js';

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

function getLoaderContent(translationsDir: string, publicPath: string) {
  return `
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
}

export type LoadTranslationsFileResult =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'custom';

/**
 * Creates or updates the generated loadTranslations.js for translationsDir
 * (relative to appDirectory) and its empty locale stubs. A loader that was
 * not matching the previous config's generated template is left untouched
 * and reported as 'custom'.
 * Directory and stub failures propagate.
 */
export async function createLoadTranslationsFile(
  appDirectory: string,
  translationsDir: string = DEFAULT_TRANSLATIONS_DIR,
  locales: string[],
  previousTranslationsDir?: string
): Promise<LoadTranslationsFileResult> {
  const usingSrcDirectory = fs.existsSync(path.join(appDirectory, 'src'));

  const loadTranslationsDir = usingSrcDirectory
    ? path.join(appDirectory, 'src')
    : appDirectory;
  const translationsPath = path.resolve(appDirectory, translationsDir);
  const publicPath = toRelativeImportPath(
    path.relative(loadTranslationsDir, translationsPath)
  );
  const filePath = path.join(loadTranslationsDir, 'loadTranslations.js');
  const content = getLoaderContent(translationsDir, publicPath);
  // Config paths lose a leading ./ through path.join, but the generated
  // comment may retain it. Both spellings must describe the same old path.
  const previousContents =
    previousTranslationsDir === undefined
      ? []
      : [
          previousTranslationsDir,
          ...(!path.isAbsolute(previousTranslationsDir)
            ? [`./${previousTranslationsDir}`]
            : []),
        ].map((directory) =>
          getLoaderContent(
            directory,
            toRelativeImportPath(
              path.relative(
                loadTranslationsDir,
                path.resolve(appDirectory, previousTranslationsDir)
              )
            )
          )
        );

  const existing = fs.existsSync(filePath)
    ? await fs.promises.readFile(filePath, 'utf8')
    : undefined;
  if (
    existing !== undefined &&
    existing !== content &&
    !previousContents.includes(existing)
  ) {
    logger.info(
      `Found a custom ${chalk.cyan('loadTranslations.js')} at ${chalk.cyan(
        filePath
      )}; leaving it unchanged.`
    );
    return 'custom';
  }

  // Stubs first, so a directory failure leaves no loader pointing at it.
  await fs.promises.mkdir(translationsPath, { recursive: true });
  for (const locale of locales) {
    const stubPath = path.join(translationsPath, `${locale}.json`);
    if (!fs.existsSync(stubPath)) await fs.promises.writeFile(stubPath, '{}');
  }
  if (existing === content) return 'unchanged';
  await fs.promises.writeFile(filePath, content);
  logger.info(
    `${existing === undefined ? 'Created' : 'Updated'} ${chalk.cyan(
      'loadTranslations.js'
    )} at ${chalk.cyan(filePath)}.`
  );
  return existing === undefined ? 'created' : 'updated';
}
