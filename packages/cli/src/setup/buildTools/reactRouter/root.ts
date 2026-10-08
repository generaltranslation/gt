// app/root.tsx: recognizing and configuring the React Router root module.
import * as t from '@babel/types';
import { Libraries } from '../../../types/libraries.js';
import { getDevelopmentEnvNames } from '../../../utils/credentials.js';
import { parseModule, type ViteLoaderExport } from '../../setupViteSPA.js';
import type { BuildToolContext, ManualAction } from '../index.js';
import {
  findHtmlDocument,
  getLangEdit,
  getWrapEdit,
  LOADER_TRANSLATIONS,
} from '../shared/document.js';
import {
  applyEdits,
  getCodeStyle,
  getImportEdit,
  getLineIndent,
  getOwnLineIndent,
  type CodeStyle,
  type Edit,
} from '../shared/edits.js';
import {
  getStorageChangeAction,
  passesLoader,
} from '../shared/initializeGT.js';
import { isChildrenSlot, rendersElement } from '../shared/jsx.js';
import {
  findDeclaredFunction,
  getLocalImport,
  getPropertyName,
  usesName,
  type DeclaredFunction,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL } from './source.js';

/** The component setup wraps Layout's content in. */
const ROOT_PROVIDER = 'RootGTProvider';

const ROOT_PROVIDER_COMMENT = [
  '// Renders GTProvider only with root loader data. Without it (a 404, or a',
  '// loader or action error), GTProvider would save the default locale over the',
  "// visitor's. GT components need GTProvider, so render them only with data.",
];

/** How the root imports loadTranslations from the loader file. */
function getLoaderBinding(loaderExport: NonNullable<ViteLoaderExport>) {
  return loaderExport === 'default'
    ? 'loadTranslations'
    : '{ loadTranslations }';
}

function getLoaderImport(
  { quote, semi }: Pick<CodeStyle, 'quote' | 'semi'>,
  loaderExport: NonNullable<ViteLoaderExport>
): string {
  return `import ${getLoaderBinding(loaderExport)} from ${quote}./loadTranslations${quote}${semi}`;
}

/** Where init saves the project ID, which Vite inlines into app code. */
const PROJECT_ID_ENV = getDevelopmentEnvNames('react-router').projectId;

/**
 * The initializeGT call. Local translations pass the loader. CDN translations
 * pass the project ID from app code, since gt-react sits outside the server
 * build and cannot read it there; a nonempty gtConfig.projectId still wins.
 */
function getInitializeCall(
  { quote, semi }: Pick<CodeStyle, 'quote' | 'semi'>,
  loaderExport: ViteLoaderExport
) {
  const configured = `${quote}projectId${quote} in gtConfig && typeof gtConfig.projectId === ${quote}string${quote} && gtConfig.projectId`;
  const options = loaderExport
    ? '{ ...gtConfig, loadTranslations }'
    : `{ ...gtConfig, projectId: (${configured}) || import.meta.env.${PROJECT_ID_ENV} }`;
  return `initializeGT(${options})${semi}`;
}

/** The imports, initializeGT call and RootGTProvider setup adds. */
function getSetupLines(
  style: CodeStyle,
  {
    configImport,
    loaderExport,
    rootData,
    typed,
  }: {
    configImport: string;
    loaderExport: ViteLoaderExport;
    rootData: string;
    typed: boolean;
  }
): string[] {
  const { quote, semi, indent } = style;
  const from = (bindings: string, source: string) =>
    `import ${bindings} from ${quote}${source}${quote}${semi}`;
  return [
    from(
      '{ GTProvider, getTranslationsSnapshot, initializeGT, parseLocale }',
      Libraries.GT_REACT
    ),
    from('gtConfig', configImport),
    ...(loaderExport ? [getLoaderImport(style, loaderExport)] : []),
    '',
    getInitializeCall(style, loaderExport),
    '',
    ...ROOT_PROVIDER_COMMENT,
    `function ${ROOT_PROVIDER}({ children }${typed ? ': { children: React.ReactNode }' : ''}) {`,
    `${indent}const data = ${rootData}${semi}`,
    `${indent}if (!data) return <>{children}</>${semi}`,
    `${indent}return (`,
    `${indent.repeat(2)}<GTProvider locale={data.locale} translations={data.translations}>`,
    `${indent.repeat(3)}{children}`,
    `${indent.repeat(2)}</GTProvider>`,
    `${indent})${semi}`,
    '}',
  ];
}

/** Adds the hook to the module's own react-router import, in its style. */
function getHookImportEdit(
  statements: t.Statement[],
  content: string,
  eol: string
): Edit | undefined {
  const routerImport = statements.find(
    (statement): statement is t.ImportDeclaration =>
      statement.type === 'ImportDeclaration' &&
      statement.source.value === 'react-router' &&
      statement.importKind !== 'type' &&
      statement.specifiers.at(-1)?.type === 'ImportSpecifier'
  );
  const last = routerImport?.specifiers.at(-1);
  if (!last) return undefined;
  const lineIndent = getOwnLineIndent(content, last.start!);
  return {
    start: last.end!,
    text:
      lineIndent === undefined
        ? ', useRouteLoaderData'
        : `,${eol}${lineIndent}useRouteLoaderData`,
  };
}

/** The expression a loader's first parameter gives for the request. */
function getRequest(param: t.Node | undefined): string | undefined {
  if (param?.type === 'Identifier') return `${param.name}.request`;
  if (param?.type !== 'ObjectPattern') return undefined;
  for (const property of param.properties) {
    if (
      property.type === 'ObjectProperty' &&
      t.isIdentifier(property.key, { name: 'request' }) &&
      property.value.type === 'Identifier'
    ) {
      return property.value.name;
    }
  }
  return undefined;
}

/**
 * Edits that return the locale and translations from the root loader: a new
 * loader before Layout, or additions to an `export async function loader`
 * whose only return is its last statement and returns an object literal.
 */
function getLoaderEdits(
  root: SourceFile & { statements: t.Statement[] },
  layout: DeclaredFunction,
  { semi, eol, indent }: CodeStyle,
  typed: boolean
): Edit[] | undefined {
  const { content, statements } = root;
  const localeLine = (request: string) =>
    `const locale = parseLocale(${request})${semi}`;
  const loader = findDeclaredFunction(statements, 'loader', { exported: true });
  if (!loader) {
    // Another `loader` binding, such as a re-export, would collide with a new one.
    if (usesName(statements, ['loader'])) return undefined;
    // Before the comments on the lines above Layout, so they stay attached to
    // Layout, and after a comment that ends the line before it.
    const start =
      layout.statement.leadingComments?.find(
        (comment) => getOwnLineIndent(content, comment.start!) !== undefined
      )?.start ?? layout.statement.start!;
    const lineIndent = getLineIndent(content, start);
    // Strict TypeScript needs a typed parameter.
    const routeTypes =
      typed && getLocalImport(root, 'Route', './+types/root', { types: true });
    const param = !typed
      ? '{ request }'
      : `{ request }: ${routeTypes ? `${routeTypes}.LoaderArgs` : '{ request: Request }'}`;
    return [
      {
        start,
        text: [
          `export async function loader(${param}) {`,
          `${lineIndent}${indent}${localeLine('request')}`,
          `${lineIndent}${indent}return { locale, ${LOADER_TRANSLATIONS} }${semi}`,
          `${lineIndent}}`,
          '',
          lineIndent,
        ].join(eol),
      },
    ];
  }

  const { fn } = loader;
  const request = getRequest(fn.params[0]);
  // A declared return type would not include the data setup adds.
  if (fn.type !== 'FunctionDeclaration' || !fn.async || fn.returnType) {
    return undefined;
  }
  const returns: t.ReturnStatement[] = [];
  t.traverseFast(fn.body, (node) => {
    if (node.type === 'ReturnStatement') returns.push(node);
  });
  const [returned] = returns;
  const object = returned?.argument;
  if (
    !request ||
    returns.length !== 1 ||
    fn.body.body.at(-1) !== returned ||
    object?.type !== 'ObjectExpression' ||
    object.properties.length === 0 ||
    object.properties.some(
      (property) =>
        property.type !== 'SpreadElement' &&
        getPropertyName(property) === undefined
    ) ||
    // The app's own locale or translations would collide with GT's.
    /\b(?:locale|translations)\b/.test(content.slice(fn.start!, fn.end!))
  ) {
    return undefined;
  }
  const returnIndent = getOwnLineIndent(content, returned.start!);
  if (returnIndent === undefined) return undefined;
  // Listed first, so the app's own properties still take precedence.
  const [first] = object.properties;
  const propertyIndent = getOwnLineIndent(content, first.start!);
  return [
    {
      start: returned.start!,
      text: `${localeLine(request)}${eol}${returnIndent}`,
    },
    {
      start: first.start!,
      text:
        propertyIndent === undefined
          ? `locale, ${LOADER_TRANSLATIONS}, `
          : `locale,${eol}${propertyIndent}${LOADER_TRANSLATIONS},${eol}${propertyIndent}`,
    },
  ];
}

/** Whether every reference to `name` inside `node` calls it. */
function onlyCalls(node: t.Node, name: string): boolean {
  let calls = true;
  t.traverse(node, (child, ancestors) => {
    const parent = ancestors.at(-1);
    if (
      t.isIdentifier(child, { name }) &&
      !(parent?.key === 'callee' && t.isCallExpression(parent.node))
    ) {
      calls = false;
    }
  });
  return calls;
}

/**
 * Configures a root module shaped like the create-react-router or Hydrogen
 * starters. Returns undefined, for manual setup, for any other shape.
 */
export function configureRoot(
  root: SourceFile,
  {
    configImport,
    loaderExport,
  }: { configImport: string; loaderExport: ViteLoaderExport }
): string | undefined {
  const { content, statements } = root;
  if (!statements) return undefined;
  const hookImport = getLocalImport(root, 'useRouteLoaderData', 'react-router');
  const hook = hookImport ?? 'useRouteLoaderData';
  // Setup's bindings must not collide with the app's, and a clientLoader's
  // data would replace the loader's while the page hydrates.
  if (
    usesName(statements, [
      'GTProvider',
      'initializeGT',
      'gtConfig',
      'getTranslationsSnapshot',
      'parseLocale',
      'loadTranslations',
      ROOT_PROVIDER,
      'clientLoader',
      ...(hookImport ? [] : [hook]),
    ])
  ) {
    return undefined;
  }
  const layout = findDeclaredFunction(statements, 'Layout', { exported: true });
  // Layout's new locale line must reach the module's loader and hook.
  if (
    layout?.fn.body.type !== 'BlockStatement' ||
    usesName([layout.fn], ['locale', 'loader']) ||
    !onlyCalls(layout.fn, hook)
  ) {
    return undefined;
  }
  const document = findHtmlDocument(layout.fn.body, isChildrenSlot);
  // Every starter Layout renders <Scripts />; RSC Framework Mode roots don't.
  if (!document || !rendersElement([document.html], 'Scripts')) {
    return undefined;
  }
  const style = getCodeStyle(content, statements);
  const { quote, semi, eol, indent } = style;
  const hookEdit = hookImport
    ? undefined
    : getHookImportEdit(statements, content, eol);
  if (!hookImport && !hookEdit) return undefined;
  const typed = /\.tsx?$/.test(root.path);
  const loaderEdits = getLoaderEdits(
    { ...root, statements },
    layout,
    style,
    typed
  );
  if (!loaderEdits) return undefined;

  const rootData = `${hook}${typed ? '<typeof loader>' : ''}(${quote}root${quote})`;
  const [first] = layout.fn.body.body;
  // Without semicolons, Layout's new first line would join a statement that
  // starts with one of these.
  if (!semi && first && '[(`+-/'.includes(content[first.start!])) {
    return undefined;
  }
  const statementIndent =
    (first && getOwnLineIndent(content, first.start!)) ??
    getLineIndent(content, layout.statement.start!) + indent;
  const configured = applyEdits(content, [
    getImportEdit(
      statements,
      getSetupLines(style, {
        configImport,
        loaderExport,
        rootData,
        typed,
      }),
      eol
    ),
    ...(hookEdit ? [hookEdit] : []),
    ...loaderEdits,
    {
      start: layout.fn.body.start! + 1,
      text: `${eol}${statementIndent}const locale = ${rootData}?.locale ?? gtConfig.defaultLocale${semi}`,
    },
    getLangEdit(document),
    getWrapEdit(
      content,
      document,
      { open: `<${ROOT_PROVIDER}>`, close: `</${ROOT_PROVIDER}>` },
      style
    ),
  ]);
  // An edit that breaks the module's syntax falls back to manual setup.
  return parseModule(configured, root.path) ? configured : undefined;
}

/**
 * For a root that initializes GT, the change its initializeGT call needs when
 * translations moved between local files and the CDN since setup ran.
 */
export function getStorageAction(
  root: SourceFile,
  initializeCall: t.CallExpression,
  ctx: BuildToolContext,
  loaderExport: ViteLoaderExport
): ManualAction | undefined {
  const loaderPassed = passesLoader(root, initializeCall.arguments[0], ctx);
  // Options this cannot read may pass the loader either way, so say nothing.
  if (loaderPassed === undefined || loaderPassed === Boolean(loaderExport)) {
    return undefined;
  }
  return getStorageChangeAction(root, ctx, loaderPassed, {
    call: getInitializeCall({ quote: "'", semi: '' }, loaderExport),
    loaderImport:
      loaderExport && getLoaderImport({ quote: "'", semi: '' }, loaderExport),
    docsUrl: DOCS_URL,
  });
}

/** The manual setup for a root module configureRoot leaves unchanged. */
export function getRootFix(
  rootPath: string,
  {
    configImport,
    loaderExport,
  }: { configImport: string; loaderExport: ViteLoaderExport }
): string {
  const loaderImport = loaderExport
    ? ` and ${getLoaderBinding(loaderExport)} from './loadTranslations'`
    : '';
  return `In ${rootPath}, import GTProvider, getTranslationsSnapshot, initializeGT and parseLocale from '${Libraries.GT_REACT}', useRouteLoaderData from 'react-router', gtConfig from '${configImport}'${loaderImport}, then call ${getInitializeCall({ quote: "'", semi: '' }, loaderExport)}. Return the locale from parseLocale(request) and translations from await getTranslationsSnapshot(locale) in the root loader. In Layout, set <html lang> to that locale, and wrap what <body> renders before <Scripts /> in a GTProvider that renders only when the root loader returned data (see ${DOCS_URL})`;
}
