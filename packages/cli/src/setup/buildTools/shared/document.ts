// What setup writes into a root module: the translations its loader returns,
// and the edits that wrap the <html> document it renders.
import * as t from '@babel/types';
import { getOwnLineIndent, type CodeStyle, type Edit } from './edits.js';
import { isJsxElementNamed } from './jsx.js';

/** The translations property the root loader returns for the document. */
export const LOADER_TRANSLATIONS =
  'translations: await getTranslationsSnapshot(locale)';

export type HtmlDocument = {
  html: t.JSXElement;
  /** The literal `lang` attribute, when the document sets one. */
  lang?: t.JSXAttribute;
  /** What `<body>` renders before `<Scripts />`: the content GTProvider wraps. */
  wrapped: t.JSXElement['children'];
  /** Set when reindenting the wrapped content would change a literal. */
  multilineLiteral: boolean;
};

/**
 * The single `<html>` a root function body renders, its literal `lang` if any,
 * and the content GTProvider wraps, which must render the route's slot exactly
 * once. Returns undefined for any other shape.
 */
export function findHtmlDocument(
  functionBody: t.BlockStatement,
  isSlot: (node: t.Node) => boolean
): HtmlDocument | undefined {
  const htmlElements: t.JSXElement[] = [];
  t.traverseFast(functionBody, (node) => {
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
      if (isSlot(node)) slots++;
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
  return { html, lang, wrapped, multilineLiteral };
}

/** Renders the document in the locale setup reads, replacing a literal lang. */
export function getLangEdit({ html, lang }: HtmlDocument): Edit {
  return lang
    ? { start: lang.start!, end: lang.end!, text: 'lang={locale}' }
    : { start: html.openingElement.name.end!, text: ' lang={locale}' };
}

/**
 * Wraps the document's content in GTProvider, which takes its translations
 * from `translations`, reindented to the depth the provider adds.
 */
export function getProviderEdit(
  content: string,
  { wrapped, multilineLiteral }: HtmlDocument,
  translations: string,
  { eol, indent }: Pick<CodeStyle, 'eol' | 'indent'>
): Edit {
  const first = wrapped[0];
  const last = wrapped.at(-1)!;
  const wrappedText = content.slice(first.start!, last.end!);
  const wrappedIndent = getOwnLineIndent(content, first.start!);
  // Reindenting would change the value of a literal that spans lines, such
  // as a template, a backslash-continued string or a JSX attribute string.
  const nestedText = multilineLiteral
    ? wrappedText
    : wrappedText.replace(/\n(?=[ \t]*\S)/g, `\n${indent}`);
  const open = getProviderTag(translations);
  return {
    start: first.start!,
    end: last.end!,
    text:
      wrappedIndent === undefined
        ? `${open}${wrappedText}</GTProvider>`
        : [
            open,
            `${wrappedIndent}${indent}${nestedText}`,
            `${wrappedIndent}</GTProvider>`,
          ].join(eol),
  };
}

/** The opening tag, so manual instructions quote what setup would write. */
export function getProviderTag(translations: string): string {
  return `<GTProvider locale={locale} translations={${translations}}>`;
}
