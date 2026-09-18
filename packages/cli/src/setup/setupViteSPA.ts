import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';

type SetupViteSPAOptions = {
  appDirectory: string;
  configFilepath: string;
  defaultLocale: string;
  locales: string[];
  translationsDir?: string;
};

const defaultBootstrapFilename = 'gt-entry.ts';
const alternateBootstrapFilename = 'gt-bootstrap.ts';

function getBootstrapConflictError(filename: string): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: 'The Vite bootstrap file already exists',
    why: `GT will not overwrite an existing src/${filename} file`,
    fix: 'Move or rename that file and rerun `npx gt@latest`',
  });
}

function getLoaderContent(translationsImport: string): string {
  return `export default async function loadTranslations(locale: string) {
  const translations = await import(\`${translationsImport}/\${locale}.json\`);
  return translations.default;
}
`;
}

function isGeneratedLoader(content: string): boolean {
  return /^export default async function loadTranslations\(locale: string\) \{\r?\n  const translations = await import\(`[^`]+\/\$\{locale\}\.json`\);\r?\n  return translations\.default;\r?\n\}\r?\n?$/.test(
    content
  );
}

function toRelativeImport(fromDirectory: string, toPath: string): string {
  const relativePath = path
    .relative(fromDirectory, toPath)
    .split(path.sep)
    .join(path.posix.sep);
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function getEntryImport(
  appDirectory: string,
  sourceDirectory: string,
  source: string
): string {
  const sourcePath = source.replace(/[?#].*$/, '');
  const entryPath = sourcePath.startsWith('/')
    ? path.resolve(appDirectory, `.${sourcePath}`)
    : path.resolve(appDirectory, sourcePath);
  return toRelativeImport(sourceDirectory, entryPath).replace(
    /\.(?:[cm]?[jt]sx?)$/i,
    ''
  );
}

function getBootstrapEntry(bootstrap: string): string | undefined {
  return bootstrap.match(/await\s+import\(\s*(['"])([^'"]+)\1\s*\)/)?.[2];
}

function getModuleEntry(indexHtml: string): {
  script: string;
  source: string;
} {
  const moduleScripts = indexHtml.match(
    /<script\b[^>]*\btype=(['"])module\1[^>]*>\s*<\/script>/gi
  );
  for (const script of moduleScripts ?? []) {
    const source = script.match(/\bsrc=(['"])([^'"]+)\1/i)?.[2];
    if (source) return { script, source };
  }

  throw new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened: 'No Vite module entry was found in index.html',
      fix: 'Add a module script for the app entry and rerun `npx gt@latest`',
    })
  );
}

export async function setupViteSPA({
  appDirectory,
  configFilepath,
  defaultLocale,
  locales,
  translationsDir,
}: SetupViteSPAOptions): Promise<void> {
  const indexHtmlPath = path.join(appDirectory, 'index.html');
  const sourceDirectory = path.join(appDirectory, 'src');
  const indexHtml = await fs.promises.readFile(indexHtmlPath, 'utf8');
  const { script, source } = getModuleEntry(indexHtml);
  const declaredEntryImport = getEntryImport(
    appDirectory,
    sourceDirectory,
    source
  );
  const configuredBootstrap = source.match(
    /^\/?src\/(gt-entry\.ts|gt-bootstrap\.ts)(?:[?#].*)?$/
  )?.[1];
  const isAlreadyConfigured = configuredBootstrap !== undefined;
  const bootstrapFilename =
    configuredBootstrap ??
    (declaredEntryImport === './gt-entry'
      ? alternateBootstrapFilename
      : defaultBootstrapFilename);
  const bootstrapPath = path.join(sourceDirectory, bootstrapFilename);
  let existingBootstrap: string | undefined;

  if (fs.existsSync(bootstrapPath)) {
    existingBootstrap = await fs.promises.readFile(bootstrapPath, 'utf8');
    if (!existingBootstrap.includes('initializeGTSPA')) {
      throw new Error(getBootstrapConflictError(bootstrapFilename));
    }
  }

  const entryImport = isAlreadyConfigured
    ? existingBootstrap && getBootstrapEntry(existingBootstrap)
    : declaredEntryImport;
  if (!entryImport) {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'The existing Vite bootstrap has no app entry import',
        fix: 'Restore the app entry import and rerun `npx gt@latest`',
      })
    );
  }

  await fs.promises.mkdir(sourceDirectory, { recursive: true });

  let loadTranslationsImport = '';
  let loadTranslationsOption = 'gtConfig';
  if (translationsDir) {
    const translationsPath = path.resolve(appDirectory, translationsDir);
    const loaderPath = path.join(sourceDirectory, 'loadTranslations.ts');
    const translationsImport = toRelativeImport(
      sourceDirectory,
      translationsPath
    );
    const existingLoader = fs.existsSync(loaderPath)
      ? await fs.promises.readFile(loaderPath, 'utf8')
      : undefined;
    if (!existingLoader || isGeneratedLoader(existingLoader)) {
      await fs.promises.writeFile(
        loaderPath,
        getLoaderContent(translationsImport)
      );
    }

    await fs.promises.mkdir(translationsPath, { recursive: true });
    for (const locale of new Set(locales)) {
      if (locale === defaultLocale) continue;
      const stubPath = path.join(translationsPath, `${locale}.json`);
      if (!fs.existsSync(stubPath)) {
        await fs.promises.writeFile(stubPath, '{}\n');
      }
    }

    loadTranslationsImport =
      "import loadTranslations from './loadTranslations';\n";
    loadTranslationsOption = '{ ...gtConfig, loadTranslations }';
  }

  const configImport = toRelativeImport(
    sourceDirectory,
    path.resolve(appDirectory, configFilepath)
  );
  await fs.promises.writeFile(
    bootstrapPath,
    `import { initializeGTSPA } from 'gt-react';
import gtConfig from '${configImport}';
${loadTranslationsImport}
await initializeGTSPA(${loadTranslationsOption});

await import('${entryImport}');
`
  );

  if (!isAlreadyConfigured) {
    const updatedScript = script.replace(source, `/src/${bootstrapFilename}`);
    await fs.promises.writeFile(
      indexHtmlPath,
      indexHtml.replace(script, updatedScript)
    );
  }

  logger.success('Configured initializeGTSPA for this Vite application.');
}
