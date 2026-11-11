import { parseSync } from 'oxc-parser';
import { walk, type ESTree, type Node } from '../analysis/ast.js';
import type { SourceRange } from '../analysis/types.js';
import {
  openingTagEnd,
  SPREAD_ATTRIBUTE,
  type SourceAttribute,
  type SourceElement,
} from './elements.js';
import type { ParseLang } from './language.js';
import { remapProgram, type Mapping } from './mapping.js';

/**
 * The elements of a file whose tooling writes its markup as JSX (Astro, MDX):
 * the generated JSX elements, at their positions in the file. Generated
 * wrappers such as `<Fragment>` are not in the file and are left out.
 */
export function jsxElements(
  file: string,
  code: string,
  lang: ParseLang,
  mappings: readonly Mapping[],
  source: string
): SourceElement[] {
  const { program } = parseSync(file, code, { lang });
  remapProgram(program, mappings, code.length);

  const elements: SourceElement[] = [];

  walk(program, {
    enter(node) {
      const element =
        node.type === 'JSXElement' ? sourceElement(node, source) : undefined;
      if (element) elements.push(element);

      return true;
    },
  });

  return elements;
}

function sourceElement(
  node: ESTree.JSXElement,
  source: string
): SourceElement | undefined {
  const opening = node.openingElement;
  const name = mappedName(opening.name);
  if (!name || !isMapped(node)) return undefined;

  const tag = source.slice(name.start, name.end);
  const isComponent = /^[A-Z_$]/.test(tag) || tag.includes('.');

  return {
    name: tag,
    start: name.end,
    end: Math.max(name.end, node.end),
    nameStart: name.start,
    nameEnd: name.end,
    openEnd: openingEnd(opening, name.end, source),
    component: isComponent,
    attributes: opening.attributes.flatMap((attribute) =>
      sourceAttribute(attribute, source)
    ),
  };
}

function openingEnd(
  opening: ESTree.JSXOpeningElement,
  nameEnd: number,
  source: string
): number {
  const hasMappedEnd = isMapped(opening) && opening.end > opening.start;
  if (hasMappedEnd) return opening.end;

  // A `>` the tool generated has no mapping: the source's own is searched for.
  const attributeEnds = opening.attributes.map((attribute) => attribute.end);

  return openingTagEnd(source, nameEnd, attributeEnds);
}

function sourceAttribute(
  attribute: ESTree.JSXAttributeItem,
  source: string
): SourceAttribute[] {
  if (attribute.type === 'JSXSpreadAttribute')
    return spreadAttribute(attribute);
  if (!isMapped(attribute)) return [];

  const name = mappedName(attribute.name);
  if (!name) return [];

  const { value } = attribute;
  const range = value && isMapped(value) ? value : attribute;
  const writtenName = source.slice(name.start, name.end);

  return [{ name: writtenName, start: range.start, end: range.end }];
}

function spreadAttribute(
  attribute: ESTree.JSXSpreadAttribute
): SourceAttribute[] {
  // astro2tsx generates the braces; the argument is in the file.
  const range = isMapped(attribute) ? attribute : attribute.argument;
  if (!isMapped(range)) return [];

  return [{ name: SPREAD_ATTRIBUTE, start: range.start, end: range.end }];
}

/** The part of a JSX name that is in the file, e.g. `Note` of MDX's `_components.Note`. */
function mappedName(name: Node): SourceRange | undefined {
  if (isMapped(name) && name.end > name.start) return name;
  if (name.type === 'JSXMemberExpression') return mappedName(name.property);
  if (name.type === 'JSXNamespacedName') return mappedName(name.name);

  return undefined;
}

function isMapped(node: SourceRange): boolean {
  return node.start >= 0;
}
