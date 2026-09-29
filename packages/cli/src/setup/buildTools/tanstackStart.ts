import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import fs from 'node:fs';
import path from 'node:path';
import { Libraries } from '../../types/libraries.js';
import { DEFAULT_VITE_TRANSLATIONS_DIR } from '../../utils/constants.js';
import {
  getLoaderExport,
  parseModule,
  toRelativeImport,
  writeViteLoader,
} from '../setupViteSPA.js';
import type {
  BuildToolContext,
  BuildToolSetup,
  ManualAction,
} from './index.js';
import { viteSetup } from './vite.js';

const DOCS_URL =
  'https://generaltranslation.com/docs/react/tanstack-start/setup';
const LOADER_FILE = 'src/loadTranslations.ts';
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
    indent: /^([ \t]+)\S/m.exec(content)?.[1] ?? '  ',
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
  return lastImport
    ? { start: lastImport.end!, text: lines.map((line) => eol + line).join('') }
    : { start: 0, text: lines.join(eol) + eol + eol };
}

function importsFromLibrary(file: SourceFile, name: string): boolean {
  return (
    file.statements?.some(
      (statement) =>
        statement.type === 'ImportDeclaration' &&
        statement.source.value === Libraries.GT_TANSTACK_START &&
        statement.importKind !== 'type' &&
        statement.specifiers.some(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind !== 'type' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === name
        )
    ) ?? false
  );
}

function getRouterLines(
  router: SourceFile,
  { appDirectory, configFilepath }: BuildToolContext,
  loaderExport: 'default' | 'loadTranslations' | undefined,
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
        getPropertyName(property) === 'loader'
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

    let loaderExport: 'default' | 'loadTranslations' | undefined;
    if (translationsDir) {
      const loader = await writeViteLoader({
        ...ctx,
        translationsDir,
        create: true,
      });
      loaderExport =
        loader === 'custom'
          ? getLoaderExport(
              await fs.promises.readFile(
                path.join(appDirectory, LOADER_FILE),
                'utf8'
              )
            )
          : 'default';
      if (loader === 'custom') {
        manualActions.push(
          loaderExport
            ? {
                whatHappened: `Your custom ${LOADER_FILE} was preserved`,
                fix: `Verify ${LOADER_FILE} loads translations from ${translationsDir}`,
              }
            : {
                whatHappened: `Your custom ${LOADER_FILE} has no runtime loadTranslations export`,
                fix: `Export a default or named loadTranslations function from ${LOADER_FILE} that loads translations from ${translationsDir}, then rerun gt init`,
              }
        );
      }
    }

    if (!start) {
      await writeSource('src/start.ts', START_CONTENT);
      steps.push('created src/start.ts');
    } else if (!/\bgtMiddleware\b/.test(start.content)) {
      manualActions.push({
        whatHappened: `${start.path} does not use gtMiddleware`,
        fix: `Import { gtMiddleware } from '${Libraries.GT_TANSTACK_START}' in ${start.path} and add it to createStart(() => ({ requestMiddleware: [gtMiddleware] })) (see ${DOCS_URL})`,
      });
    }

    // A custom loader without an export already has its own action.
    if (
      !importsFromLibrary(router, 'initializeGT') &&
      (!translationsDir || loaderExport)
    ) {
      const style = router.statements
        ? getCodeStyle(router.content, router.statements)
        : { quote: "'", semi: ';', eol: '\n' };
      const lines = getRouterLines(router, ctx, loaderExport, style);
      // Any other mention may be an app-owned initializer; a second
      // initializeGT call would override it.
      if (router.statements && !/\binitializeGT\b/.test(router.content)) {
        await writeSource(
          router.path,
          applyEdits(router.content, [
            getImportEdit(router.statements, lines, style.eol),
          ])
        );
        steps.push(`configured ${router.path}`);
      } else {
        manualActions.push({
          whatHappened: `${router.path} was not configured automatically`,
          fix: `Initialize GT after the imports in ${router.path}: ${lines.filter(Boolean).join(' ')} (see ${DOCS_URL})`,
        });
      }
    }

    if (!/\bGTProvider\b/.test(root.content)) {
      const configured = configureRootRoute(root);
      if (configured) {
        await writeSource(root.path, configured);
        steps.push(`configured ${root.path}`);
      } else {
        manualActions.push({
          whatHappened: `${root.path} does not match the create-start root route`,
          fix: `In ${root.path}, add loader: async () => { const locale = getLocale(); return { locale, translations: await getTranslationsSnapshot(locale) }; } to createRootRoute, read const { locale, translations } = Route.useLoaderData() in the document, set <html lang={locale}>, and wrap its children in <GTProvider locale={locale} translations={translations}>, importing GTProvider, getLocale and getTranslationsSnapshot from '${Libraries.GT_TANSTACK_START}' (see ${DOCS_URL})`,
        });
      }
    }

    return { steps, manualActions };
  },
};
