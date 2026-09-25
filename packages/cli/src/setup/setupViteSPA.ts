import { parse } from '@babel/parser';
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

function getEntryPath(appDirectory: string, source: string): string {
  const sourcePath = source.replace(/[?#].*$/, '');
  return sourcePath.startsWith('/')
    ? path.resolve(appDirectory, `.${sourcePath}`)
    : path.resolve(appDirectory, sourcePath);
}

function getEntryImport(
  appDirectory: string,
  sourceDirectory: string,
  source: string
): string {
  return toRelativeImport(
    sourceDirectory,
    getEntryPath(appDirectory, source)
  ).replace(/\.(?:[cm]?[jt]sx?)$/i, '');
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

/**
 * Reads the Vite entry and bootstrap without writing, so setup can report an
 * unsupported layout before changing any file.
 */
export async function inspectViteSPA(appDirectory: string) {
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
  const declaredEntryPath = getEntryPath(appDirectory, source);
  let customBootstrap: string | undefined;
  if (!configuredBootstrap && fs.existsSync(declaredEntryPath)) {
    const entry = await fs.promises.readFile(declaredEntryPath, 'utf8');
    const importsInitializer = parse(entry, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    }).program.body.some(
      (statement) =>
        statement.type === 'ImportDeclaration' &&
        statement.source.value === 'gt-react' &&
        statement.importKind !== 'type' &&
        statement.specifiers.some(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind !== 'type' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'initializeGTSPA'
        )
    );
    if (importsInitializer) {
      customBootstrap = path.relative(appDirectory, declaredEntryPath);
    }
  }
  const isAlreadyConfigured = configuredBootstrap !== undefined;
  const bootstrapFilename =
    configuredBootstrap ??
    (declaredEntryImport === './gt-entry'
      ? alternateBootstrapFilename
      : defaultBootstrapFilename);
  const bootstrapPath = path.join(sourceDirectory, bootstrapFilename);
  let existingBootstrap: string | undefined;

  if (!customBootstrap && fs.existsSync(bootstrapPath)) {
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
  return {
    indexHtmlPath,
    sourceDirectory,
    indexHtml,
    script,
    source,
    isAlreadyConfigured,
    customBootstrap,
    bootstrapFilename,
    bootstrapPath,
    entryImport,
  };
}

export type ViteLoaderResult = 'written' | 'custom' | 'missing';

/**
 * Points the generated src/loadTranslations.ts at translationsDir and adds
 * empty locale stubs. A custom loader is left unchanged; an absent one is
 * only created with `create`.
 */
export async function writeViteLoader({
  appDirectory,
  defaultLocale,
  locales,
  translationsDir,
  create,
}: Omit<SetupViteSPAOptions, 'configFilepath' | 'translationsDir'> & {
  translationsDir: string;
  create: boolean;
}): Promise<ViteLoaderResult> {
  const sourceDirectory = path.join(appDirectory, 'src');
  const translationsPath = path.resolve(appDirectory, translationsDir);
  const loaderPath = path.join(sourceDirectory, 'loadTranslations.ts');
  const existingLoader = fs.existsSync(loaderPath)
    ? await fs.promises.readFile(loaderPath, 'utf8')
    : undefined;
  if (existingLoader === undefined && !create) return 'missing';
  const custom = !!existingLoader && !isGeneratedLoader(existingLoader);

  // Stubs first, so a directory failure leaves no loader pointing at it.
  await fs.promises.mkdir(translationsPath, { recursive: true });
  for (const locale of new Set(locales)) {
    if (locale === defaultLocale) continue;
    const stubPath = path.join(translationsPath, `${locale}.json`);
    if (!fs.existsSync(stubPath)) {
      await fs.promises.writeFile(stubPath, '{}\n');
    }
  }
  if (custom) return 'custom';
  await fs.promises.writeFile(
    loaderPath,
    getLoaderContent(toRelativeImport(sourceDirectory, translationsPath))
  );
  return 'written';
}

function getLoaderExport(
  content: string
): 'default' | 'loadTranslations' | undefined {
  const statements = parse(content, {
    sourceType: 'module',
    plugins: ['typescript'],
  }).program.body;
  const names = new Set<string>();
  for (const statement of statements) {
    if (statement.type === 'ExportDefaultDeclaration') names.add('default');
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.exportKind === 'type'
    )
      continue;
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ExportSpecifier' &&
        specifier.exportKind !== 'type'
      ) {
        names.add(
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value
        );
      }
    }
    const declaration = statement.declaration;
    if (
      declaration?.type === 'FunctionDeclaration' &&
      !declaration.declare &&
      declaration.id
    ) {
      names.add(declaration.id.name);
    }
    if (declaration?.type === 'VariableDeclaration' && !declaration.declare) {
      for (const variable of declaration.declarations) {
        if (variable.id.type === 'Identifier') names.add(variable.id.name);
      }
    }
  }
  if (names.has('default')) return 'default';
  if (names.has('loadTranslations')) return 'loadTranslations';
  return undefined;
}

export async function setupViteSPA({
  appDirectory,
  configFilepath,
  defaultLocale,
  locales,
  translationsDir,
}: SetupViteSPAOptions): Promise<{
  loader?: ViteLoaderResult;
  manualAction?: string;
}> {
  const {
    indexHtmlPath,
    sourceDirectory,
    indexHtml,
    script,
    source,
    isAlreadyConfigured,
    customBootstrap,
    bootstrapFilename,
    bootstrapPath,
    entryImport,
  } = await inspectViteSPA(appDirectory);

  // An app-owned initializer may have custom imports and options. Nesting a
  // generated initializer around it would initialize GT twice.
  if (customBootstrap) {
    return {
      manualAction: `Verify the existing GT bootstrap ${customBootstrap} uses ${configFilepath}${translationsDir ? ` and loads translations from ${translationsDir}` : ' with CDN loading'}`,
    };
  }

  await fs.promises.mkdir(sourceDirectory, { recursive: true });

  let loadTranslationsImport = '';
  let loadTranslationsOption = 'gtConfig';
  let loader: ViteLoaderResult | undefined;
  if (translationsDir) {
    loader = await writeViteLoader({
      appDirectory,
      defaultLocale,
      locales,
      translationsDir,
      create: true,
    });
    const loaderExport =
      loader === 'custom'
        ? getLoaderExport(
            await fs.promises.readFile(
              path.join(sourceDirectory, 'loadTranslations.ts'),
              'utf8'
            )
          )
        : 'default';
    if (!loaderExport) {
      return {
        loader,
        manualAction: `Update your custom src/loadTranslations.ts to load translations from ${translationsDir} and export a default or named loadTranslations function, then rerun gt init`,
      };
    }
    loadTranslationsImport =
      loaderExport === 'default'
        ? "import loadTranslations from './loadTranslations';\n"
        : "import { loadTranslations } from './loadTranslations';\n";
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
  return { loader };
}
