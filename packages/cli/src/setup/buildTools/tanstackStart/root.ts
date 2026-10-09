// src/routes/__root.tsx: recognizing and configuring the root route.
import * as t from '@babel/types';
import { Libraries } from '../../../types/libraries.js';
import {
  findHtmlDocument,
  getLangEdit,
  getProviderEdit,
  getProviderTag,
  LOADER_TRANSLATIONS,
} from '../shared/document.js';
import {
  applyEdits,
  getCodeStyle,
  getImportEdit,
  getLineIndent,
  getOwnLineIndent,
} from '../shared/edits.js';
import {
  isChildrenSlot,
  isJsxElementNamed,
  rendersElement,
} from '../shared/jsx.js';
import {
  findDeclaredFunction,
  getPropertyName,
  usesName,
  type DeclaredFunction,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL } from './source.js';

/** The translations GTProvider reads, which the root loader returns. */
const TRANSLATIONS = 'translations';

type LocalFunction = DeclaredFunction['fn'];

function findLocalFunction(
  statements: t.Statement[],
  name: string
): LocalFunction | undefined {
  return findDeclaredFunction(statements, name)?.fn;
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
        id.type !== 'Identifier' ||
        init?.type !== 'CallExpression' ||
        init.arguments[0]?.type !== 'ObjectExpression'
      ) {
        continue;
      }
      const { callee } = init;
      // Router context adds a call: createRootRouteWithContext<Ctx>()({...}).
      if (
        (callee.type === 'Identifier' && callee.name === 'createRootRoute') ||
        (callee.type === 'CallExpression' &&
          callee.arguments.length === 0 &&
          callee.callee.type === 'Identifier' &&
          callee.callee.name === 'createRootRouteWithContext')
      ) {
        return { routeName: id.name, options: init.arguments[0] };
      }
    }
  }
  return undefined;
}

/**
 * The local function that renders the document: the route component itself
 * when it renders `<html>`, or the one local component it returns with only
 * the route's slot as its child. A followed document must render nowhere
 * else: another render, such as an errorComponent, has no loader data.
 */
function findDocument(
  statements: t.Statement[],
  component: LocalFunction,
  isShell: boolean
): LocalFunction | undefined {
  if (rendersElement([component.body], 'html')) return component;
  const { body } = component;
  const returned =
    body.type !== 'BlockStatement'
      ? body
      : body.body.length === 1 && body.body[0].type === 'ReturnStatement'
        ? body.body[0].argument
        : undefined;
  if (
    returned?.type !== 'JSXElement' ||
    returned.openingElement.name.type !== 'JSXIdentifier'
  ) {
    return undefined;
  }
  const children = returned.children.filter(
    (child) => child.type !== 'JSXText' || child.value.trim() !== ''
  );
  if (
    children.length !== 1 ||
    !(isShell
      ? isChildrenSlot(children[0])
      : isJsxElementNamed(children[0], 'Outlet'))
  ) {
    return undefined;
  }
  const { name } = returned.openingElement.name;
  // Its declaration and the route component's element are the only uses.
  let uses = 0;
  for (const statement of statements) {
    t.traverseFast(statement, (node) => {
      if (isJsxElementNamed(node, name) || t.isIdentifier(node, { name })) {
        uses++;
      }
    });
  }
  if (uses !== 2) return undefined;
  const document = findLocalFunction(statements, name);
  return document && rendersElement([document.body], 'html')
    ? document
    : undefined;
}

/**
 * The root route, the local function its shellComponent or component names,
 * and the local function that renders its document.
 */
export function findRootComponent(statements: t.Statement[]) {
  const rootRoute = findRootRoute(statements);
  if (!rootRoute) return undefined;
  const { properties } = rootRoute.options;
  const componentProperty =
    properties.find((p) => getPropertyName(p) === 'shellComponent') ??
    properties.find((p) => getPropertyName(p) === 'component');
  const component =
    componentProperty?.type === 'ObjectProperty' &&
    componentProperty.value.type === 'Identifier'
      ? findLocalFunction(statements, componentProperty.value.name)
      : undefined;
  const isShell =
    componentProperty !== undefined &&
    getPropertyName(componentProperty) === 'shellComponent';
  const document = component && findDocument(statements, component, isShell);
  return { rootRoute, componentProperty, component, isShell, document };
}

/**
 * Configures the create-start root route: `createRootRoute({...})` (or its
 * router-context form) without a loader, whose shellComponent renders
 * `{children}` (or whose component renders `<Outlet />`) once in the `<body>`
 * of a local `<html>` document, either directly or through one local document
 * component that renders its `{children}` there. Returns undefined for any
 * other shape.
 */
export function configureRootRoute({
  content,
  statements,
}: SourceFile): string | undefined {
  if (!statements) return undefined;
  // Generated bindings must not shadow or collide with the app's own.
  if (usesName(statements, ['getLocale', 'getTranslationsSnapshot'])) {
    return undefined;
  }
  const found = findRootComponent(statements);
  if (!found) return undefined;
  const { rootRoute, componentProperty, component, isShell, document } = found;
  const { properties } = rootRoute.options;
  if (
    properties.some((property) => {
      const name = getPropertyName(property);
      // A spread or computed key could be any of the options below.
      // A throwing beforeLoad or validateSearch skips the loader, so the
      // shell would render without the locale and translations it reads.
      return (
        name === undefined ||
        name === 'loader' ||
        name === 'beforeLoad' ||
        name === 'validateSearch'
      );
    })
  ) {
    return undefined;
  }
  if (
    componentProperty?.type !== 'ObjectProperty' ||
    !component ||
    document?.body.type !== 'BlockStatement' ||
    // Deliberately text, not usesName: a component taking a locale or
    // translations prop has its own plumbing, and a JSX attribute name is not
    // an identifier.
    [component, document].some((fn) =>
      /\b(?:locale|translations)\b/.test(content.slice(fn.start!, fn.end!))
    )
  ) {
    return undefined;
  }
  // A followed document receives the route's slot as its children.
  const slotIsChildren = isShell || document !== component;
  const htmlDocument = findHtmlDocument(document.body, (node) =>
    slotIsChildren ? isChildrenSlot(node) : isJsxElementNamed(node, 'Outlet')
  );
  if (!htmlDocument) return undefined;
  const propertyIndent = getOwnLineIndent(content, componentProperty.start!);
  if (propertyIndent === undefined) return undefined;

  const style = getCodeStyle(content, statements);
  const { quote, semi, eol, indent } = style;
  const firstStatement = document.body.body[0];
  const statementIndent =
    (firstStatement && getOwnLineIndent(content, firstStatement.start!)) ??
    getLineIndent(content, document.start!) + indent;
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
        `${propertyIndent}${indent}return { locale, ${LOADER_TRANSLATIONS} }${semi}`,
        `${propertyIndent}},`,
        propertyIndent,
      ].join(eol),
    },
    {
      start: document.body.start! + 1,
      text: `${eol}${statementIndent}const { locale, translations } = ${rootRoute.routeName}.useLoaderData()${semi}`,
    },
    getLangEdit(htmlDocument),
    getProviderEdit(content, htmlDocument, TRANSLATIONS, style),
  ]);
}

export function getRootFix(rootPath: string): string {
  return `In ${rootPath}, add loader: async () => { const locale = getLocale(); return { locale, ${LOADER_TRANSLATIONS} }; } to the root route options, read const { locale, translations } = Route.useLoaderData() in the document, set <html lang={locale}>, and wrap everything its <body> renders before <Scripts /> in ${getProviderTag(TRANSLATIONS)}, importing GTProvider, getLocale and getTranslationsSnapshot from '${Libraries.GT_TANSTACK_START}' (see ${DOCS_URL})`;
}
