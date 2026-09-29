import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import fs from 'node:fs';
import path from 'node:path';
import { Libraries } from '../../types/libraries.js';
import { DEFAULT_VITE_TRANSLATIONS_DIR } from '../../utils/constants.js';
import {
  getViteLoaderExport,
  parseModule,
  toRelativeImport,
  writeViteLoader,
  type ViteLoaderExport,
} from '../setupViteSPA.js';
import type {
  BuildToolContext,
  BuildToolSetup,
  ManualAction,
} from './index.js';
import { VITE_LOADER_FILE, viteSetup } from './vite.js';

const DOCS_URL =
  'https://generaltranslation.com/docs/react/tanstack-start/setup';
// Start resolves its entries by basename, so any of these may be the entry.
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

const START_CONTENT = `import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { gtMiddleware } from '${Libraries.GT_TANSTACK_START}';

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, gtMiddleware],
}));
`;

type SourceFile = {
  /** Relative to the app, with forward slashes. */
  path: string;
  content: string;
  /** Undefined when the file cannot be parsed. */
  statements?: t.Statement[];
};

type Edit = { start: number; end?: number; text: string };

type CodeStyle = { quote: string; semi: string; eol: string; indent: string };

async function readSourceFile(
  appDirectory: string,
  basename: string
): Promise<SourceFile | undefined> {
  for (const extension of SOURCE_EXTENSIONS) {
    const relativePath = `${basename}${extension}`;
    const absolutePath = path.join(appDirectory, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const content = await fs.promises.readFile(absolutePath, 'utf8');
    return {
      path: relativePath,
      content,
      statements: parseModule(content, relativePath),
    };
  }
  return undefined;
}

function getMissingFileError(file: string): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened: 'GT cannot configure this TanStack Start app',
      why: `${file} was not found`,
      reassurance: 'Nothing was changed',
      fix: 'Run `npx gt@latest init` from the app root, or set up GT manually',
      docsUrl: DOCS_URL,
    })
  );
}

/** Reads the Start entries without writing, so a missing one stops setup. */
async function inspectTanStackStart(appDirectory: string) {
  const router = await readSourceFile(appDirectory, 'src/router');
  if (!router) throw getMissingFileError('src/router.tsx');
  const root = await readSourceFile(appDirectory, 'src/routes/__root');
  if (!root) throw getMissingFileError('src/routes/__root.tsx');
  return {
    router,
    root,
    start: await readSourceFile(appDirectory, 'src/start'),
  };
}

function getImports(statements: t.Statement[]): t.ImportDeclaration[] {
  return statements.filter(
    (statement): statement is t.ImportDeclaration =>
      statement.type === 'ImportDeclaration'
  );
}

/** Generated lines follow the file's last import, so they read as its own. */
function getCodeStyle(content: string, statements: t.Statement[]): CodeStyle {
  const lastImport = getImports(statements).at(-1);
  return {
    quote: lastImport ? content[lastImport.source.start!] : "'",
    semi:
      lastImport &&
      !content.slice(lastImport.start!, lastImport.end!).endsWith(';')
        ? ''
        : ';',
    eol: content.includes('\r\n') ? '\r\n' : '\n',
    // Skips JSDoc continuation lines, whose ` * ` is not an indent unit.
    indent: /^([ \t]+)[^\s*]/m.exec(content)?.[1] ?? '  ',
  };
}

function getLineStart(content: string, position: number): number {
  return content.lastIndexOf('\n', position - 1) + 1;
}

function getLineIndent(content: string, position: number): string {
  return /^[ \t]*/.exec(content.slice(getLineStart(content, position)))![0];
}

/** The indent before position, or undefined when code precedes it. */
function getOwnLineIndent(
  content: string,
  position: number
): string | undefined {
  const prefix = content.slice(getLineStart(content, position), position);
  return /^[ \t]*$/.test(prefix) ? prefix : undefined;
}

/** Inserts at original offsets, last first, so earlier offsets stay valid. */
function applyEdits(content: string, edits: Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, text }) =>
        result.slice(0, start) + text + result.slice(end ?? start),
      content
    );
}

function getImportEdit(
  statements: t.Statement[],
  lines: string[],
  eol: string
): Edit {
  const lastImport = getImports(statements).at(-1);
  if (!lastImport) return { start: 0, text: lines.join(eol) + eol + eol };
  // A same-line comment such as `// eslint-disable-line` stays on its import.
  const lineComment = lastImport.trailingComments
    ?.filter((comment) => comment.loc!.start.line === lastImport.loc!.end.line)
    .at(-1);
  return {
    start: lineComment?.end ?? lastImport.end!,
    text: lines.map((line) => eol + line).join(''),
  };
}

/** The local name `name` is imported as from gt-tanstack-start. */
function getLocalImport(file: SourceFile, name: string): string | undefined {
  for (const statement of file.statements ?? []) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.source.value !== Libraries.GT_TANSTACK_START ||
      statement.importKind === 'type'
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === name
      ) {
        return specifier.local.name;
      }
    }
  }
  return undefined;
}

/** The module-scope `initializeGT(...)` call, which must run before requests. */
function findInitializeCall(file: SourceFile): t.CallExpression | undefined {
  const local = getLocalImport(file, 'initializeGT');
  if (!local) return undefined;
  for (const statement of file.statements ?? []) {
    if (
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'CallExpression' &&
      statement.expression.callee.type === 'Identifier' &&
      statement.expression.callee.name === local
    ) {
      return statement.expression;
    }
  }
  return undefined;
}

/** Whether code outside the imports references `name`; comments do not count. */
function referencesOutsideImports(file: SourceFile, name: string): boolean {
  let found = false;
  for (const statement of file.statements ?? []) {
    if (statement.type === 'ImportDeclaration') continue;
    t.traverseFast(statement, (node) => {
      if (node.type === 'Identifier' && node.name === name) found = true;
    });
  }
  return found;
}

function rendersElement(file: SourceFile, name: string): boolean {
  let found = false;
  for (const statement of file.statements ?? []) {
    t.traverseFast(statement, (node) => {
      if (isJsxElementNamed(node, name)) found = true;
    });
  }
  return found;
}

function getRouterLines(
  router: SourceFile,
  { appDirectory, configFilepath }: BuildToolContext,
  loaderExport: ViteLoaderExport,
  { quote, semi }: Pick<CodeStyle, 'quote' | 'semi'>
): string[] {
  const configImport = toRelativeImport(
    path.dirname(path.join(appDirectory, router.path)),
    path.resolve(appDirectory, configFilepath)
  );
  const loaderImport = toRelativeImport(
    path.dirname(path.join(appDirectory, router.path)),
    path.join(appDirectory, 'src/loadTranslations')
  );
  const importFrom = (bindings: string, source: string) =>
    `import ${bindings} from ${quote}${source}${quote}${semi}`;
  return [
    importFrom('{ initializeGT }', Libraries.GT_TANSTACK_START),
    importFrom('gtConfig', configImport),
    ...(loaderExport
      ? [
          importFrom(
            loaderExport === 'default'
              ? 'loadTranslations'
              : '{ loadTranslations }',
            loaderImport
          ),
        ]
      : []),
    '',
    `initializeGT(${loaderExport ? '{ ...gtConfig, loadTranslations }' : 'gtConfig'})${semi}`,
  ];
}

function isJsxElementNamed(node: t.Node, name: string): node is t.JSXElement {
  return (
    node.type === 'JSXElement' &&
    node.openingElement.name.type === 'JSXIdentifier' &&
    node.openingElement.name.name === name
  );
}

function isChildrenSlot(node: t.Node): boolean {
  return (
    node.type === 'JSXExpressionContainer' &&
    node.expression.type === 'Identifier' &&
    node.expression.name === 'children'
  );
}

function getPropertyName(
  property: t.ObjectExpression['properties'][number]
): string | undefined {
  if (property.type === 'SpreadElement' || property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'StringLiteral') return property.key.value;
  return undefined;
}

function findLocalFunction(statements: t.Statement[], name: string) {
  for (const statement of statements) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement;
    if (
      declaration?.type === 'FunctionDeclaration' &&
      declaration.id?.name === name
    ) {
      return declaration;
    }
    if (declaration?.type !== 'VariableDeclaration') continue;
    if (declaration.kind !== 'const') continue;
    for (const declarator of declaration.declarations) {
      if (
        declarator.id.type === 'Identifier' &&
        declarator.id.name === name &&
        (declarator.init?.type === 'ArrowFunctionExpression' ||
          declarator.init?.type === 'FunctionExpression')
      ) {
        return declarator.init;
      }
    }
  }
  return undefined;
}

function findRootRoute(statements: t.Statement[]) {
  for (const statement of statements) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const { id, init } of declaration.declarations) {
      if (
        id.type === 'Identifier' &&
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === 'createRootRoute' &&
        init.arguments[0]?.type === 'ObjectExpression'
      ) {
        return { routeName: id.name, options: init.arguments[0] };
      }
    }
  }
  return undefined;
}

/**
 * Configures the create-start root route: `createRootRoute({...})` without a
 * loader, whose shellComponent renders `{children}` (or whose component
 * renders `<Outlet />`) in the `<body>` of a local `<html>` document.
 * Returns undefined for any other shape.
 */
function configureRootRoute({
  content,
  statements,
}: SourceFile): string | undefined {
  if (!statements) return undefined;
  // Generated bindings must not shadow or collide with the app's own.
  if (/\b(?:getLocale|getTranslationsSnapshot)\b/.test(content)) {
    return undefined;
  }
  const rootRoute = findRootRoute(statements);
  if (!rootRoute) return undefined;
  const { properties } = rootRoute.options;
  if (
    properties.some(
      (property) =>
        property.type === 'SpreadElement' ||
        getPropertyName(property) === 'loader' ||
        // A throwing beforeLoad skips the loader, so the shell would render
        // without the locale and translations the generated code reads.
        getPropertyName(property) === 'beforeLoad'
    )
  ) {
    return undefined;
  }
  const componentProperty =
    properties.find((p) => getPropertyName(p) === 'shellComponent') ??
    properties.find((p) => getPropertyName(p) === 'component');
  if (
    componentProperty?.type !== 'ObjectProperty' ||
    componentProperty.value.type !== 'Identifier'
  ) {
    return undefined;
  }
  const isShell = getPropertyName(componentProperty) === 'shellComponent';
  const component = findLocalFunction(statements, componentProperty.value.name);
  if (
    component?.body.type !== 'BlockStatement' ||
    /\b(?:locale|translations)\b/.test(
      content.slice(component.start!, component.end!)
    )
  ) {
    return undefined;
  }
  const htmlElements: t.JSXElement[] = [];
  t.traverseFast(component.body, (node) => {
    if (isJsxElementNamed(node, 'html')) htmlElements.push(node);
  });
  if (htmlElements.length !== 1) return undefined;
  const [html] = htmlElements;
  const bodies = html.children.filter((child) =>
    isJsxElementNamed(child, 'body')
  );
  if (bodies.length !== 1) return undefined;
  const slots = bodies[0].children.filter((child) =>
    isShell ? isChildrenSlot(child) : isJsxElementNamed(child, 'Outlet')
  );
  if (slots.length !== 1) return undefined;
  const { attributes } = html.openingElement;
  if (attributes.some((attribute) => attribute.type === 'JSXSpreadAttribute')) {
    return undefined;
  }
  const lang = attributes.find(
    (attribute): attribute is t.JSXAttribute =>
      attribute.type === 'JSXAttribute' &&
      attribute.name.type === 'JSXIdentifier' &&
      attribute.name.name === 'lang'
  );
  // A computed lang is the app's own locale logic.
  if (lang && lang.value?.type !== 'StringLiteral') return undefined;
  const propertyIndent = getOwnLineIndent(content, componentProperty.start!);
  if (propertyIndent === undefined) return undefined;

  const { quote, semi, eol, indent } = getCodeStyle(content, statements);
  const [slot] = slots;
  const slotText = content.slice(slot.start!, slot.end!);
  const slotIndent = getOwnLineIndent(content, slot.start!);
  const provider = '<GTProvider locale={locale} translations={translations}>';
  const firstStatement = component.body.body[0];
  const statementIndent =
    (firstStatement && getOwnLineIndent(content, firstStatement.start!)) ??
    getLineIndent(content, component.start!) + indent;
  return applyEdits(content, [
    getImportEdit(
      statements,
      [
        `import { GTProvider, getLocale, getTranslationsSnapshot } from ${quote}${Libraries.GT_TANSTACK_START}${quote}${semi}`,
      ],
      eol
    ),
    {
      start: componentProperty.start!,
      text: [
        'loader: async () => {',
        `${propertyIndent}${indent}const locale = getLocale()${semi}`,
        `${propertyIndent}${indent}return { locale, translations: await getTranslationsSnapshot(locale) }${semi}`,
        `${propertyIndent}},`,
        propertyIndent,
      ].join(eol),
    },
    {
      start: component.body.start! + 1,
      text: `${eol}${statementIndent}const { locale, translations } = ${rootRoute.routeName}.useLoaderData()${semi}`,
    },
    lang
      ? { start: lang.start!, end: lang.end!, text: 'lang={locale}' }
      : { start: html.openingElement.name.end!, text: ' lang={locale}' },
    {
      start: slot.start!,
      end: slot.end!,
      text:
        slotIndent === undefined
          ? `${provider}${slotText}</GTProvider>`
          : [
              provider,
              `${slotIndent}${indent}${slotText}`,
              `${slotIndent}</GTProvider>`,
            ].join(eol),
    },
  ]);
}

export const tanstackStartSetup: BuildToolSetup = {
  framework: 'tanstack-start',
  defaultTranslationsDir: DEFAULT_VITE_TRANSLATIONS_DIR,
  initializer: 'initializeGT',
  ownsLoader: true,
  skipsGTInstall: () => false,
  devCredentialsOption: '--live-translations',
  async preflight(appDirectory) {
    await inspectTanStackStart(appDirectory);
  },
  // The loader is the same file Vite generates.
  syncLoader: viteSetup.syncLoader,
  async apply(ctx) {
    const { appDirectory, translationsDir } = ctx;
    const { router, root, start } = await inspectTanStackStart(appDirectory);
    const steps: string[] = [];
    const manualActions: ManualAction[] = [];
    const writeSource = async (file: string, content: string) => {
      await fs.promises.writeFile(path.join(appDirectory, file), content);
    };

    let loaderExport: ViteLoaderExport;
    if (translationsDir) {
      const loader = await writeViteLoader({
        ...ctx,
        translationsDir,
        create: true,
      });
      loaderExport = await getViteLoaderExport(appDirectory, loader);
      if (loader === 'custom') {
        manualActions.push(
          loaderExport
            ? {
                whatHappened: `Your custom ${VITE_LOADER_FILE} was preserved`,
                fix: `Verify ${VITE_LOADER_FILE} loads translations from ${translationsDir}`,
              }
            : {
                whatHappened: `Your custom ${VITE_LOADER_FILE} has no runtime loadTranslations export`,
                fix: `Export a default or named loadTranslations function from ${VITE_LOADER_FILE} that loads translations from ${translationsDir}, then rerun gt init`,
              }
        );
      }
    }

    // An insertion that breaks the file's syntax falls back to manual setup.
    const parses = (file: SourceFile, content: string | undefined) =>
      content !== undefined && parseModule(content, file.path) !== undefined
        ? content
        : undefined;

    const initializeCall = findInitializeCall(router);
    let routerReady = initializeCall !== undefined;
    let configuredRouter: string | undefined;
    // Storage chosen on a rerun must match how the router loads translations.
    const wantsLoader = Boolean(translationsDir);
    const [initializeOptions] = initializeCall?.arguments ?? [];
    const passesLoader =
      initializeOptions?.type === 'ObjectExpression' &&
      initializeOptions.properties.some(
        (property) => getPropertyName(property) === 'loadTranslations'
      );
    if (
      initializeCall &&
      passesLoader !== wantsLoader &&
      (!translationsDir || loaderExport)
    ) {
      const [call] = getRouterLines(router, ctx, loaderExport, {
        quote: "'",
        semi: '',
      }).slice(-1);
      manualActions.push({
        whatHappened: `${router.path} initializes GT for ${passesLoader ? 'local translation files' : 'CDN translations'}, but translations are now ${translationsDir ? `stored in ${translationsDir}` : 'loaded from the CDN'}`,
        fix: `Change the initializeGT call in ${router.path} to ${call}${wantsLoader ? ` and import loadTranslations from ${VITE_LOADER_FILE}` : ' and remove the loadTranslations import'} (see ${DOCS_URL})`,
      });
    }
    // A custom loader without an export already has its own action.
    if (!routerReady && (!translationsDir || loaderExport)) {
      const style = router.statements
        ? getCodeStyle(router.content, router.statements)
        : { quote: "'", semi: ';', eol: '\n' };
      // Any other mention may be an app-owned initializer; a second
      // initializeGT call would override it.
      if (router.statements && !/\binitializeGT\b/.test(router.content)) {
        configuredRouter = parses(
          router,
          applyEdits(router.content, [
            getImportEdit(
              router.statements,
              getRouterLines(router, ctx, loaderExport, style),
              style.eol
            ),
          ])
        );
      }
      routerReady = configuredRouter !== undefined;
      if (!routerReady) {
        const lines = getRouterLines(router, ctx, loaderExport, {
          quote: style.quote,
          semi: ';',
        });
        manualActions.push({
          whatHappened: `${router.path} was not configured automatically`,
          fix: `Initialize GT after the imports in ${router.path}: ${lines.filter(Boolean).join(' ')} (see ${DOCS_URL})`,
        });
      }
    }

    if (start && !referencesOutsideImports(start, 'gtMiddleware')) {
      manualActions.push({
        whatHappened: `${start.path} does not use gtMiddleware`,
        fix: `Import { gtMiddleware } from '${Libraries.GT_TANSTACK_START}' in ${start.path} and add it to the requestMiddleware of createStart, keeping your existing middleware such as the CSRF middleware (see ${DOCS_URL})`,
      });
    }

    const rootFix = `In ${root.path}, add loader: async () => { const locale = getLocale(); return { locale, translations: await getTranslationsSnapshot(locale) }; } to createRootRoute, read const { locale, translations } = Route.useLoaderData() in the document, set <html lang={locale}>, and wrap its children in <GTProvider locale={locale} translations={translations}>, importing GTProvider, getLocale and getTranslationsSnapshot from '${Libraries.GT_TANSTACK_START}' (see ${DOCS_URL})`;
    const rootConfigured = rendersElement(root, 'GTProvider');
    const configuredRoot = rootConfigured
      ? undefined
      : parses(root, configureRootRoute(root));
    if (!rootConfigured && !configuredRoot) {
      manualActions.push({
        whatHappened: `${root.path} does not match the create-start root route`,
        fix: rootFix,
      });
    }

    // gtMiddleware and the root loader need initializeGT to have run, so
    // they are only added alongside a router that calls it.
    if (routerReady) {
      if (!start) {
        await writeSource('src/start.ts', START_CONTENT);
        steps.push('created src/start.ts');
      }
      if (configuredRouter) {
        await writeSource(router.path, configuredRouter);
        steps.push(`configured ${router.path}`);
      }
      if (configuredRoot) {
        await writeSource(root.path, configuredRoot);
        steps.push(`configured ${root.path}`);
      }
    } else {
      const reason = `because ${router.path} does not initialize GT`;
      if (!start) {
        manualActions.push({
          whatHappened: `src/start.ts was not created ${reason}`,
          fix: `Create src/start.ts with const csrfMiddleware = createCsrfMiddleware({ filter: ({ handlerType }) => handlerType === 'serverFn' }); export const startInstance = createStart(() => ({ requestMiddleware: [csrfMiddleware, gtMiddleware] })), importing createCsrfMiddleware and createStart from '@tanstack/react-start' and gtMiddleware from '${Libraries.GT_TANSTACK_START}' (see ${DOCS_URL})`,
        });
      }
      if (configuredRoot) {
        manualActions.push({
          whatHappened: `${root.path} was left unchanged ${reason}`,
          fix: rootFix,
        });
      }
    }

    return { steps, manualActions };
  },
};
