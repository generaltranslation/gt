import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import chalk from 'chalk';
import { DEFAULT_TRANSLATIONS_DIR } from '../utils/constants.js';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

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

/**
 * Where the generated loader runs. A bundler resolves the JSON import itself.
 * Node.js refuses a JSON import without `with { type: 'json' }`, so the Node
 * loader reads the file when the import fails. It imports node:fs/promises
 * only then, so a bundler can still build it, for a server or a browser.
 */
const LOADER_RUNTIMES = ['bundler', 'node'] as const;
export type LoadTranslationsRuntime = (typeof LOADER_RUNTIMES)[number];

function getLoaderContent(
  translationsDir: string,
  publicPath: string,
  runtime: LoadTranslationsRuntime = 'bundler'
) {
  if (runtime === 'node') {
    // new URL() reads #, ? and % in a path as URL syntax, so the file URL
    // encodes each directory name.
    const fileUrlPath = publicPath.split('/').map(encodeURIComponent).join('/');
    return `export default async function loadTranslations(locale) {
  try {
    // Load translations from ${translationsDir} directory
    // This matches the GT config files.gt.output path
    try {
      // A bundler resolves this import when it builds the app or server
      return (await import(\`${publicPath}\${locale}.json\`)).default;
    } catch {
      // Node.js refuses a JSON import without an import attribute
      const { readFile } = await import('node:fs/promises');
      const file = new URL(\`${fileUrlPath}\${locale}.json\`, import.meta.url);
      return JSON.parse(await readFile(file, 'utf8'));
    }
  } catch (error) {
    console.warn(\`Failed to load translations for locale \${locale}:\`, error);
    return {};
  }
}
`;
  }
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

/** Reported when a gt-node rerun keeps a loader that imports JSON as a bundler does. */
function bundlerLoaderInNodeDiagnostic(filePath: string) {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: `${filePath} imports JSON without an import attribute`,
    why: 'Node.js refuses that import, so the loader returns no translations unless a bundler builds your server',
    fix: 'If Node.js runs your server directly, delete loadTranslations.js and run `gt init` again',
  });
}

/**
 * Every loadTranslations file the app has, in gt-next's lookup order
 * (resolveConfigFilepath): root before src, .ts before .js. gt-next uses the
 * first one, and falls back to the next when it is deleted.
 */
export function findLoadTranslationsFiles(appDirectory: string): string[] {
  return ['', 'src']
    .flatMap((directory) =>
      ['.ts', '.js'].map((extension) =>
        path.join(appDirectory, directory, `loadTranslations${extension}`)
      )
    )
    .filter((candidate) => fs.existsSync(candidate));
}

export type LoadTranslationsFileResult =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'custom';

/**
 * Creates or updates the generated loadTranslations.js for translationsDir
 * (relative to appDirectory) and empty stubs for non-default locales. A
 * loader that was not matching the previous config's generated template, or
 * another loadTranslations file the app uses instead, is left untouched and
 * reported as 'custom'. A generated loader keeps its runtime when it is
 * updated, so a bundled server keeps the bundler loader it can run.
 * Directory and stub failures propagate.
 */
export async function createLoadTranslationsFile({
  appDirectory,
  translationsDir = DEFAULT_TRANSLATIONS_DIR,
  defaultLocale,
  locales,
  previousTranslationsDir,
  runtime = 'bundler',
}: {
  appDirectory: string;
  translationsDir?: string;
  defaultLocale: string;
  locales: string[];
  previousTranslationsDir?: string;
  runtime?: LoadTranslationsRuntime;
}): Promise<LoadTranslationsFileResult> {
  const usingSrcDirectory = fs.existsSync(path.join(appDirectory, 'src'));

  const loadTranslationsDir = usingSrcDirectory
    ? path.join(appDirectory, 'src')
    : appDirectory;
  const translationsPath = path.resolve(appDirectory, translationsDir);
  const publicPath = toRelativeImportPath(
    path.relative(loadTranslationsDir, translationsPath)
  );
  const filePath = path.join(loadTranslationsDir, 'loadTranslations.js');
  // Config paths lose leading ./ and trailing / through path.join, and use
  // the platform separator, but generated comments keep the spelling they
  // were written with. Keep the import and body exact.
  const previousLoaders = (loaderRuntime: LoadTranslationsRuntime) => {
    if (previousTranslationsDir === undefined) return [];
    const previousPublicPath = toRelativeImportPath(
      path.relative(
        loadTranslationsDir,
        path.resolve(appDirectory, previousTranslationsDir)
      )
    );
    return [
      ...new Set([
        previousTranslationsDir,
        previousTranslationsDir.split(path.sep).join(path.posix.sep),
      ]),
    ]
      .flatMap((directory) => [
        directory,
        ...(!path.isAbsolute(directory) ? [`./${directory}`] : []),
      ])
      .flatMap((directory) => [directory, `${directory}/`])
      .map((directory) =>
        getLoaderContent(directory, previousPublicPath, loaderRuntime)
      );
  };

  const [loaderPath] = findLoadTranslationsFiles(appDirectory);
  const existing =
    loaderPath === filePath
      ? await fs.promises.readFile(filePath, 'utf8')
      : undefined;
  const existingRuntime =
    existing === undefined
      ? undefined
      : LOADER_RUNTIMES.find((loaderRuntime) =>
          [
            getLoaderContent(translationsDir, publicPath, loaderRuntime),
            ...previousLoaders(loaderRuntime),
          ].includes(existing)
        );
  const content = getLoaderContent(
    translationsDir,
    publicPath,
    existingRuntime ?? runtime
  );
  // Stubs first, so a directory failure leaves no loader pointing at it; a
  // custom loader also gets them, like the Vite loader.
  await fs.promises.mkdir(translationsPath, { recursive: true });
  for (const locale of new Set(locales)) {
    // Default-locale content lives in source, so it never needs a stub.
    if (locale === defaultLocale) continue;
    const stubPath = path.join(translationsPath, `${locale}.json`);
    if (!fs.existsSync(stubPath)) await fs.promises.writeFile(stubPath, '{}');
  }
  // Another loader wins over the generated one, so writing it would not help.
  if (
    (loaderPath !== undefined && loaderPath !== filePath) ||
    (existing !== undefined && existingRuntime === undefined)
  ) {
    logger.info(
      `Found a custom ${chalk.cyan(
        path.basename(loaderPath ?? filePath)
      )} at ${chalk.cyan(loaderPath ?? filePath)}; leaving it unchanged.`
    );
    return 'custom';
  }

  if (runtime === 'node' && existingRuntime === 'bundler') {
    logger.warn(bundlerLoaderInNodeDiagnostic(filePath));
  }

  // A loader for the same directory, spelled differently, already works.
  if (
    existing === content ||
    (existing !== undefined &&
      previousTranslationsDir !== undefined &&
      path.resolve(appDirectory, previousTranslationsDir) === translationsPath)
  )
    return 'unchanged';
  await fs.promises.writeFile(filePath, content);
  logger.info(
    `${existing === undefined ? 'Created' : 'Updated'} ${chalk.cyan(
      'loadTranslations.js'
    )} at ${chalk.cyan(filePath)}.`
  );
  return existing === undefined ? 'created' : 'updated';
}
