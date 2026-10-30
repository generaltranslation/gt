// src/routes/__root.*: the document lang, from the locale GT resolved.
import * as t from '@babel/types';
import { parseModule } from '../../setupViteSPA.js';
import type { ManualAction } from '../index.js';
import { applyEdits, getCodeStyle, getImportEdit } from '../shared/edits.js';
import { isChildrenSlot, isJsxElementNamed } from '../shared/jsx.js';
import {
  getBindingAt,
  getLocalImport,
  getPropertyName,
  usesName,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL, GT_IMPORT_SOURCES, type GTImportSources } from './source.js';

const USE_LOCALE = 'useLocale';

function getLangAttribute(html: t.JSXElement): t.JSXAttribute | undefined {
  return html.openingElement.attributes.find(
    (attribute): attribute is t.JSXAttribute =>
      attribute.type === 'JSXAttribute' &&
      t.isJSXIdentifier(attribute.name, { name: 'lang' })
  );
}

/** A lang the app computes itself, rather than a fixed string. */
function hasComputedLang(html: t.JSXElement): boolean {
  const value = getLangAttribute(html)?.value;
  if (value?.type !== 'JSXExpressionContainer') return false;
  const { expression } = value;
  return !(
    expression.type === 'StringLiteral' ||
    (expression.type === 'TemplateLiteral' &&
      expression.expressions.length === 0)
  );
}

/** Functions declared at the top level under a component name. */
function getTopLevelComponents(
  statements: t.Statement[]
): { name: string; fn: t.Function }[] {
  const components: { name: string; fn: t.Function }[] = [];
  const isComponentName = (name: string) => /^[A-Z]/.test(name);
  for (const statement of statements) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration'
        ? statement.declaration
        : statement;
    if (
      declaration?.type === 'FunctionDeclaration' &&
      declaration.id &&
      isComponentName(declaration.id.name)
    ) {
      components.push({ name: declaration.id.name, fn: declaration });
    }
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const { id, init } of declaration.declarations) {
      if (
        t.isIdentifier(id) &&
        isComponentName(id.name) &&
        (init?.type === 'ArrowFunctionExpression' ||
          init?.type === 'FunctionExpression')
      ) {
        components.push({ name: id.name, fn: init });
      }
    }
  }
  return components;
}

/**
 * What a function returns on every call: its expression body, or a return
 * that is both its last statement and its only one. Hooks are valid there.
 */
function getAlwaysReturned(fn: t.Function): t.Node | undefined {
  if (fn.body.type !== 'BlockStatement') return fn.body;
  let returns = 0;
  t.traverseFast(fn.body, (node) => {
    if (node.type === 'ReturnStatement') returns++;
  });
  const last = fn.body.body.at(-1);
  return returns === 1 && last?.type === 'ReturnStatement'
    ? (last.argument ?? undefined)
    : undefined;
}

/**
 * Whether the component is only rendered: used as a JSX element or passed as
 * a route option. A call, an alias or any other use could run it outside a
 * render, where a hook throws.
 */
function isOnlyRendered(
  statements: t.Statement[],
  component: { name: string; fn: t.Function }
): boolean {
  const binding = getBindingAt(statements, component.fn, component.name);
  // A same-named function expression or parameter hides the module binding,
  // whose references are the ones that matter.
  return (
    binding?.scope.block.type === 'Program' &&
    binding.referencePaths.every(
      ({ node, parent }) =>
        node.type === 'JSXIdentifier' ||
        (parent.type === 'ObjectProperty' && parent.value === node)
    )
  );
}

/** `<html lang={useLocale()}>` in place of a literal or missing lang. */
function setLang(
  root: SourceFile,
  statements: t.Statement[],
  html: t.JSXElement,
  sources: GTImportSources
): string | undefined {
  const { content } = root;
  const { attributes, name } = html.openingElement;
  if (attributes.some((attribute) => attribute.type === 'JSXSpreadAttribute')) {
    return undefined;
  }
  // Hooks only run reliably during a component's render, on every render,
  // and a direct call could run it outside one.
  const component = getTopLevelComponents(statements).find(
    ({ fn }) => getAlwaysReturned(fn) === html
  );
  if (!component || !isOnlyRendered(statements, component)) {
    return undefined;
  }
  const local = getLocalImport(root, USE_LOCALE, sources.runtime);
  // Another binding with this name would clash with the added import, and a
  // local binding could hide the existing one where the hook is called.
  if (
    local
      ? getBindingAt(statements, html.openingElement, local)?.kind !== 'module'
      : usesName(statements, [USE_LOCALE])
  ) {
    return undefined;
  }
  const lang = getLangAttribute(html);
  const attribute = `lang={${local ?? USE_LOCALE}()}`;
  const { quote, semi, eol } = getCodeStyle(content, statements);
  const configured = applyEdits(content, [
    lang
      ? { start: lang.start!, end: lang.end!, text: attribute }
      : { start: name.end!, text: ` ${attribute}` },
    ...(local
      ? []
      : [
          getImportEdit(
            statements,
            [
              `import { ${USE_LOCALE} } from ${quote}${sources.runtime}${quote}${semi}`,
            ],
            eol
          ),
        ]),
  ]);
  return parseModule(configured, root.path) ? configured : undefined;
}

/**
 * The root route with `<html lang={useLocale()}>` in place of a hard-coded
 * or missing lang, a manual step when that edit is not clearly safe,
 * undefined when there is nothing to change, or null when the root has no
 * `<html>` to inspect, such as a document imported from another file.
 * useLocale reads the provider setupRouterGTIntegration renders, so write the
 * result only once the router is integrated.
 */
export function configureRootLang(
  root: SourceFile,
  sources: GTImportSources = GT_IMPORT_SOURCES
): string | ManualAction | null | undefined {
  const { statements } = root;
  if (!statements) return null;
  const htmlElements: t.JSXElement[] = [];
  for (const statement of statements) {
    t.traverseFast(statement, (node) => {
      if (isJsxElementNamed(node, 'html')) htmlElements.push(node);
    });
  }
  if (htmlElements.length === 0) return null;
  // A computed lang is the app's own locale logic.
  if (htmlElements.every(hasComputedLang)) {
    return undefined;
  }
  return (
    (htmlElements.length === 1 &&
      setLang(root, statements, htmlElements[0], sources)) ||
    getRootLangAction(root.path, sources)
  );
}

/**
 * The options of the root route, `{}` when it passes none, or undefined when
 * the file has no createRootRoute call.
 */
function findRootRouteOptions(statements: t.Statement[]): t.Node | undefined {
  let call: t.CallExpression | undefined;
  for (const statement of statements) {
    t.traverseFast(statement, (node) => {
      if (call || node.type !== 'CallExpression') return;
      const { callee } = node;
      // Router context adds a call: createRootRouteWithContext<Ctx>()({...}).
      if (
        t.isIdentifier(callee, { name: 'createRootRoute' }) ||
        (callee.type === 'CallExpression' &&
          t.isIdentifier(callee.callee, { name: 'createRootRouteWithContext' }))
      ) {
        call = node;
      }
    });
  }
  if (!call) return undefined;
  return call.arguments[0] ?? t.objectExpression([]);
}

// Elements of the document that render no visible UI.
const DOCUMENT_ELEMENTS = new Set([
  'html',
  'body',
  'Outlet',
  'Scripts',
  'HeadContent',
]);

/**
 * Whether the root route renders anything visible besides the document: the
 * shellComponent and component may only render `<html>`, its `<head>`, and in
 * `<body>` the route's slot, `<Scripts />` and devtools, directly or through
 * local components. Anything GT cannot follow counts as visible.
 */
export function rendersRootUI(root: SourceFile): boolean {
  const { statements } = root;
  if (!statements) return true;
  const options = findRootRouteOptions(statements);
  if (options?.type !== 'ObjectExpression') return true;
  const components = new Map(
    getTopLevelComponents(statements).map(({ name, fn }) => [name, fn])
  );
  const followed = new Set<string>();
  const rendersOnlyDocument = (node: t.Node | null | undefined): boolean => {
    if (!node) return false;
    if (node.type === 'JSXFragment') {
      return node.children.every(rendersOnlyDocument);
    }
    if (node.type === 'JSXText') return node.value.trim() === '';
    if (node.type === 'JSXExpressionContainer') {
      return (
        node.expression.type === 'JSXEmptyExpression' || isChildrenSlot(node)
      );
    }
    if (node.type !== 'JSXElement') return false;
    const { name } = node.openingElement;
    if (name.type !== 'JSXIdentifier') return false;
    if (name.name === 'head') return true;
    const childrenOnlyDocument = node.children.every(rendersOnlyDocument);
    // Devtools render nothing in the production build the shell comes from.
    if (DOCUMENT_ELEMENTS.has(name.name) || name.name.endsWith('Devtools')) {
      return childrenOnlyDocument;
    }
    const component = components.get(name.name);
    if (!component) return false;
    if (followed.has(name.name)) return childrenOnlyDocument;
    followed.add(name.name);
    return (
      childrenOnlyDocument && rendersOnlyDocument(getAlwaysReturned(component))
    );
  };
  const names = options.properties.map(getPropertyName);
  // A spread or computed key could be either component.
  if (names.includes(undefined)) return true;
  return ['shellComponent', 'component'].some((option) => {
    const index = names.lastIndexOf(option);
    if (index === -1) return false;
    const property = options.properties[index];
    if (property.type !== 'ObjectProperty') return true;
    const { value } = property;
    const fn =
      value.type === 'Identifier'
        ? components.get(value.name)
        : value.type === 'ArrowFunctionExpression' ||
            value.type === 'FunctionExpression'
          ? value
          : undefined;
    return !fn || !rendersOnlyDocument(getAlwaysReturned(fn));
  });
}

export function getSpaShellAction(rootPath: string): ManualAction {
  return {
    whatHappened: `SPA mode prerenders ${rootPath} into the shell every visitor gets, and it renders more than the document, so visitors see that UI before their translations load, and any translated text in it switches language after`,
    fix: `Keep the root route to the <html> document, {children} and <Scripts />, and move the rest, such as navigation, into a pathless layout route like src/routes/_app.tsx with your pages under src/routes/_app/, so the shell stays blank until translations load (see ${DOCS_URL})`,
  };
}

export function getRootLangAction(
  rootPath: string,
  sources: GTImportSources = GT_IMPORT_SOURCES
): ManualAction {
  return {
    whatHappened: `${rootPath} was not configured automatically`,
    fix: `Call const locale = ${USE_LOCALE}() at the top of the root route's document component, before any early return, and render <html lang={locale}>, with import { ${USE_LOCALE} } from '${sources.runtime}', so the page language follows the resolved locale (see ${DOCS_URL})`,
  };
}
