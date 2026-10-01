// src/routes/__root.tsx: recognizing and configuring the root route.
import * as t from '@babel/types';
import { Libraries } from '../../../types/libraries.js';
import {
  applyEdits,
  getCodeStyle,
  getImportEdit,
  getLineIndent,
  getOwnLineIndent,
} from './edits.js';
import { DOCS_URL, getPropertyName, type SourceFile } from './source.js';

function isJsxElementNamed(node: t.Node, name: string): node is t.JSXElement {
  return (
    node.type === 'JSXElement' &&
    t.isJSXIdentifier(node.openingElement.name, { name })
  );
}

function isChildrenSlot(node: t.Node): boolean {
  return (
    node.type === 'JSXExpressionContainer' &&
    node.expression.type === 'Identifier' &&
    node.expression.name === 'children'
  );
}

export function rendersElement(nodes: t.Node[], name: string): boolean {
  let found = false;
  for (const node of nodes) {
    t.traverseFast(node, (child) => {
      if (isJsxElementNamed(child, name)) found = true;
    });
  }
  return found;
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
        t.isIdentifier(declarator.id, { name }) &&
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

/** The root route and the local function its shellComponent or component names. */
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
  return { rootRoute, componentProperty, component };
}

/**
 * Configures the create-start root route: `createRootRoute({...})` (or its
 * router-context form) without a loader, whose shellComponent renders
 * `{children}` (or whose component renders `<Outlet />`) once in the `<body>`
 * of a local `<html>` document. Returns undefined for any other shape.
 */
export function configureRootRoute({
  content,
  statements,
}: SourceFile): string | undefined {
  if (!statements) return undefined;
  // Generated bindings must not shadow or collide with the app's own.
  if (/\b(?:getLocale|getTranslationsSnapshot)\b/.test(content)) {
    return undefined;
  }
  const found = findRootComponent(statements);
  if (!found) return undefined;
  const { rootRoute, componentProperty, component } = found;
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
  if (componentProperty?.type !== 'ObjectProperty') return undefined;
  const isShell = getPropertyName(componentProperty) === 'shellComponent';
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
  // Headers, footers and app providers around the slot render GT too, so the
  // provider wraps everything the body renders before <Scripts />.
  const bodyContent = bodies[0].children.filter(
    (child) => child.type !== 'JSXText' || child.value.trim() !== ''
  );
  const scriptsIndex = bodyContent.findIndex((child) =>
    isJsxElementNamed(child, 'Scripts')
  );
  const wrapped =
    scriptsIndex === -1 ? bodyContent : bodyContent.slice(0, scriptsIndex);
  let slots = 0;
  let multilineLiteral = false;
  for (const child of wrapped) {
    t.traverseFast(child, (node) => {
      if (isShell ? isChildrenSlot(node) : isJsxElementNamed(node, 'Outlet')) {
        slots++;
      }
      if (
        (node.type === 'TemplateLiteral' || node.type === 'StringLiteral') &&
        node.loc!.start.line !== node.loc!.end.line
      ) {
        multilineLiteral = true;
      }
    });
  }
  if (slots !== 1) return undefined;
  const { attributes } = html.openingElement;
  if (attributes.some((attribute) => attribute.type === 'JSXSpreadAttribute')) {
    return undefined;
  }
  const lang = attributes.find(
    (attribute): attribute is t.JSXAttribute =>
      attribute.type === 'JSXAttribute' &&
      t.isJSXIdentifier(attribute.name, { name: 'lang' })
  );
  // A computed lang is the app's own locale logic.
  if (lang && lang.value?.type !== 'StringLiteral') return undefined;
  const propertyIndent = getOwnLineIndent(content, componentProperty.start!);
  if (propertyIndent === undefined) return undefined;

  const { quote, semi, eol, indent } = getCodeStyle(content, statements);
  const first = wrapped[0];
  const last = wrapped.at(-1)!;
  const wrappedText = content.slice(first.start!, last.end!);
  const wrappedIndent = getOwnLineIndent(content, first.start!);
  // Reindenting would change the value of a literal that spans lines, such
  // as a template, a backslash-continued string or a JSX attribute string.
  const nestedText = multilineLiteral
    ? wrappedText
    : wrappedText.replace(/\n(?=[ \t]*\S)/g, `\n${indent}`);
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
      start: first.start!,
      end: last.end!,
      text:
        wrappedIndent === undefined
          ? `${provider}${wrappedText}</GTProvider>`
          : [
              provider,
              `${wrappedIndent}${indent}${nestedText}`,
              `${wrappedIndent}</GTProvider>`,
            ].join(eol),
    },
  ]);
}

export function getRootFix(rootPath: string): string {
  return `In ${rootPath}, add loader: async () => { const locale = getLocale(); return { locale, translations: await getTranslationsSnapshot(locale) }; } to the root route options, read const { locale, translations } = Route.useLoaderData() in the document, set <html lang={locale}>, and wrap everything its <body> renders before <Scripts /> in <GTProvider locale={locale} translations={translations}>, importing GTProvider, getLocale and getTranslationsSnapshot from '${Libraries.GT_TANSTACK_START}' (see ${DOCS_URL})`;
}
