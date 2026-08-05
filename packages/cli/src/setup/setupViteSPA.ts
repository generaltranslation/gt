import { createDiagnosticMessage } from 'generaltranslation/internal';
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

const bootstrapConflictError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'The Vite bootstrap file already exists',
  why: 'GT will not overwrite an existing src/index.ts file',
  fix: 'Move or rename that file and rerun `npx gt@latest`',
});

function toRelativeImport(fromDirectory: string, toPath: string): string {
  const relativePath = path
    .relative(fromDirectory, toPath)
    .split(path.sep)
    .join(path.posix.sep);
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
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
  const bootstrapPath = path.join(sourceDirectory, 'index.ts');
  const indexHtml = await fs.promises.readFile(indexHtmlPath, 'utf8');
  const { script, source } = getModuleEntry(indexHtml);
  const isAlreadyConfigured = /^\/?src\/index\.ts(?:[?#].*)?$/.test(source);

  if (fs.existsSync(bootstrapPath)) {
    const bootstrap = await fs.promises.readFile(bootstrapPath, 'utf8');
    if (!bootstrap.includes('initializeGTSPA')) {
      throw new Error(bootstrapConflictError);
    }
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
    if (!fs.existsSync(loaderPath)) {
      await fs.promises.writeFile(
        loaderPath,
        `export default async function loadTranslations(locale: string) {
  const translations = await import(\`${translationsImport}/\${locale}.json\`);
  return translations.default;
}
`
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

  if (!fs.existsSync(bootstrapPath)) {
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

await import('./main'); // render the app only after GT is ready
`
    );
  }

  if (!isAlreadyConfigured) {
    const updatedScript = script.replace(source, '/src/index.ts');
    await fs.promises.writeFile(
      indexHtmlPath,
      indexHtml.replace(script, updatedScript)
    );
  }

  logger.success('Configured initializeGTSPA for this Vite application.');
}
