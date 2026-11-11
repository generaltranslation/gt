import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { walk, type ESTree } from '../analysis/ast.js';
import type {
  ElementContext,
  ElementRange,
  SourceRange,
} from '../analysis/types.js';
import {
  containsOffset,
  innermostAt,
  type SourceAttribute,
} from './elements.js';

type Parse5Node = DefaultTreeAdapterMap['node'];
type Parse5Element = DefaultTreeAdapterMap['element'];
type Parse5Location = NonNullable<Parse5Element['sourceCodeLocation']>;

// Lit, lit-html, uhtml, htm.
const MARKUP_TAGS = new Set([
  'html',
  'svg',
  'mathml',
  'htm',
  'staticHtml',
  'staticSvg',
]);

// One per character of a `${…}` in the text parse5 reads, so that offsets stay the source's.
const PLACEHOLDER = '_';
const ONLY_PLACEHOLDERS = /^_+$/;

const EXPRESSION_ATTRIBUTE = '${…}';

type TemplateElement = {
  /** As written, e.g. "sl-button". */
  name: string;
  start: number;
  end: number;
  openingTag: SourceRange;
  /** Each attribute's whole range, `name=value`. */
  attributes: SourceAttribute[];
};

export function mayHaveTaggedTemplates(code: string): boolean {
  return /(?:html|svg|mathml|htm)\s*`/i.test(code);
}

/**
 * The element and attribute of each `${…}` in `` html`…` `` templates:
 * `` html`<button title=${m.x()}>` `` → `<button title={…}>`. A nested template's
 * ranges come after its parent's, so the innermost one wins.
 */
export function taggedTemplateElements(
  program: ESTree.Program,
  code: string
): ElementRange[] {
  const ranges: ElementRange[] = [];

  walk(program, {
    enter(node) {
      if (node.type === 'TaggedTemplateExpression' && isMarkupTag(node.tag)) {
        ranges.push(...expressionContexts(node.quasi, code));
      }

      return true;
    },
  });

  return ranges;
}

function isMarkupTag(tag: ESTree.Expression): boolean {
  if (tag.type === 'Identifier') return MARKUP_TAGS.has(tag.name);

  return (
    tag.type === 'MemberExpression' &&
    !tag.computed &&
    tag.property.type === 'Identifier' &&
    MARKUP_TAGS.has(tag.property.name)
  );
}

function expressionContexts(
  template: ESTree.TemplateLiteral,
  code: string
): ElementRange[] {
  const [firstQuasi] = template.quasis;
  if (!firstQuasi) return [];

  const markup = markupText(template, code);
  const elements = templateElements(markup);
  const ranges: ElementRange[] = [];

  for (const expression of template.expressions) {
    const offsetInMarkup = expression.start - firstQuasi.start;
    const context = contextAt(elements, offsetInMarkup);
    if (!context) continue;

    ranges.push({ start: expression.start, end: expression.end, context });
  }

  return ranges;
}

function markupText({ quasis }: ESTree.TemplateLiteral, code: string): string {
  let text = '';

  quasis.forEach((quasi, index) => {
    text += code.slice(quasi.start, quasi.end);

    const next = quasis[index + 1];
    if (next) text += PLACEHOLDER.repeat(next.start - quasi.end);
  });

  return text;
}

function templateElements(text: string): TemplateElement[] {
  const elements: TemplateElement[] = [];

  const visit = (node: Parse5Node) => {
    if ('tagName' in node) {
      const element = templateElement(node, text);
      if (element) elements.push(element);

      if (isTemplate(node)) node.content.childNodes.forEach(visit);
    }

    if ('childNodes' in node) node.childNodes.forEach(visit);
  };

  const fragment = parseFragment(text, { sourceCodeLocationInfo: true });
  fragment.childNodes.forEach(visit);

  return elements;
}

function templateElement(
  node: Parse5Element,
  text: string
): TemplateElement | undefined {
  const location = node.sourceCodeLocation;
  const openingTag = location?.startTag;
  if (!location || !openingTag) return undefined;

  // parse5 lowercases names; the template's own spelling is kept.
  const nameStart = openingTag.startOffset + 1;
  const name = text.slice(nameStart, nameStart + node.tagName.length);

  return {
    name,
    start: location.startOffset,
    end: location.endOffset,
    openingTag: { start: openingTag.startOffset, end: openingTag.endOffset },
    attributes: templateAttributes(node, location, text),
  };
}

function templateAttributes(
  node: Parse5Element,
  location: Parse5Location,
  text: string
): SourceAttribute[] {
  const attributes: SourceAttribute[] = [];

  for (const { name } of node.attrs) {
    const range = location.attrs?.[name];
    if (!range) continue;

    const attributeText = text.slice(range.startOffset, range.endOffset);
    const [writtenName = ''] = attributeText.split('=');

    attributes.push({
      name: writtenName.trim(),
      start: range.startOffset,
      end: range.endOffset,
    });
  }

  return attributes;
}

function isTemplate(
  element: Parse5Element
): element is DefaultTreeAdapterMap['template'] {
  return element.tagName === 'template';
}

function contextAt(
  elements: readonly TemplateElement[],
  offset: number
): ElementContext | undefined {
  const tagged = elements.find((element) =>
    containsOffset(element.openingTag, offset)
  );
  if (tagged)
    return { element: tagged.name, attribute: attributeNameAt(tagged, offset) };

  const innermost = innermostAt(elements, offset);

  return innermost && { element: innermost.name };
}

function attributeNameAt(element: TemplateElement, offset: number): string {
  const attribute = element.attributes.find((candidate) =>
    containsOffset(candidate, offset)
  );
  if (!attribute) return EXPRESSION_ATTRIBUTE;

  // `<div ${ref(x)}>`: the expression is the attribute's name.
  const nameEnd = attribute.start + attribute.name.length;
  const isInName = ONLY_PLACEHOLDERS.test(attribute.name) || offset < nameEnd;

  return isInName ? EXPRESSION_ATTRIBUTE : attribute.name;
}
