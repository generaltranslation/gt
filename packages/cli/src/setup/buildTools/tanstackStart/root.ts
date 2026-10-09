// src/routes/__root.*: the document lang, from the locale GT resolved.
import * as t from '@babel/types';
import { Libraries } from '../../../types/libraries.js';
import { parseModule } from '../../setupViteSPA.js';
import type { ManualAction } from '../index.js';
import { applyEdits, getCodeStyle, getImportEdit } from '../shared/edits.js';
import { isJsxElementNamed } from '../shared/jsx.js';
import {
  callsFunction,
  getBindingAt,
  getLocalImport,
  usesName,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL } from './source.js';

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

/** `<html lang={useLocale()}>` in place of a literal or missing lang. */
function setLang(
  root: SourceFile,
  statements: t.Statement[],
  html: t.JSXElement
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
  if (!component || callsFunction(statements, component.name)) {
    return undefined;
  }
  const local = getLocalImport(root, USE_LOCALE, Libraries.GT_TANSTACK_START);
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
              `import { ${USE_LOCALE} } from ${quote}${Libraries.GT_TANSTACK_START}${quote}${semi}`,
            ],
            eol
          ),
        ]),
  ]);
  return parseModule(configured, root.path) ? configured : undefined;
}

/**
 * The root route with `<html lang={useLocale()}>` in place of a hard-coded
 * or missing lang, a manual step when that edit is not clearly safe, or
 * undefined when there is nothing to change. useLocale reads the provider
 * setupRouterGTIntegration renders, so write the result only once the router
 * is integrated.
 */
export function configureRootLang(
  root: SourceFile
): string | ManualAction | undefined {
  const { statements } = root;
  if (!statements) return undefined;
  const htmlElements: t.JSXElement[] = [];
  for (const statement of statements) {
    t.traverseFast(statement, (node) => {
      if (isJsxElementNamed(node, 'html')) htmlElements.push(node);
    });
  }
  // A computed lang is the app's own locale logic.
  if (htmlElements.every(hasComputedLang)) {
    return undefined;
  }
  return (
    (htmlElements.length === 1 && setLang(root, statements, htmlElements[0])) ||
    getRootLangAction(root.path)
  );
}

export function getRootLangAction(rootPath: string): ManualAction {
  return {
    whatHappened: `${rootPath} was not configured automatically`,
    fix: `Set <html lang={${USE_LOCALE}()}> in the root route's document component, with import { ${USE_LOCALE} } from '${Libraries.GT_TANSTACK_START}', so the page language follows the resolved locale (see ${DOCS_URL})`,
  };
}
