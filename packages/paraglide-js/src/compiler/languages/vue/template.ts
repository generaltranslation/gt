import type {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  ExpressionNode,
  ForNode,
  IfBranchNode,
  RootNode,
  SourceLocation,
  TemplateChildNode,
} from '@vue/compiler-dom';
import type { SourceRange } from '../../analysis/types.js';
import {
  openingTagEnd,
  type SourceAttribute,
  type SourceElement,
} from '../elements.js';

// Values of @vue/compiler-core's `NodeTypes` and `ElementTypes`. The compiler is
// the project's own, so only its types are imported.
const ELEMENT = 1;
const INTERPOLATION = 5;
const ATTRIBUTE = 6;
const DIRECTIVE = 7;
const IF = 9;
const FOR = 11;
const COMPONENT_TAG = 1;

/** The SFC's `template.ast`. Its offsets are relative to `contentStart`. */
export type ParsedTemplate = {
  ast: RootNode;
  contentStart: number;
  contentEnd: number;
  /** `@vue/language-plugin-pug` gives pug offsets, some of them unknown (-1). */
  isPug: boolean;
};

export function templateElements(
  template: ParsedTemplate,
  source: string
): SourceElement[] {
  const collector = new ElementCollector(template, source);
  collector.addElements(template.ast.children, template.contentEnd);

  return collector.elements;
}

export function templateExpressions({
  ast,
  contentStart,
}: ParsedTemplate): SourceRange[] {
  const locations: Array<SourceLocation | undefined> = [];

  const visit = (node: TemplateChildNode) => {
    locations.push(...expressionLocations(node));
    childrenOf(node).forEach(visit);
  };

  ast.children.forEach(visit);

  return locations
    .filter(hasKnownText)
    .map((location) => fileRange(location, contentStart));
}

class ElementCollector {
  readonly elements: SourceElement[] = [];
  private readonly structuralAttributes: Map<ElementNode, SourceAttribute[]>;

  constructor(
    private readonly template: ParsedTemplate,
    private readonly source: string
  ) {
    const { ast, contentStart } = template;
    this.structuralAttributes = structuralAttributesByElement(
      ast,
      contentStart,
      source
    );
  }

  /** Returns where the last of `siblings` ends. */
  addElements(
    siblings: readonly TemplateChildNode[],
    parentEnd: number
  ): number {
    const { contentStart } = this.template;
    let siblingsEnd = -1;

    siblings.forEach((node, index) => {
      if (node.type === ELEMENT) {
        const nextSiblingStart = this.nextSiblingStart(
          siblings,
          index,
          parentEnd
        );
        siblingsEnd = Math.max(
          siblingsEnd,
          this.addElement(node, nextSiblingStart)
        );
      } else {
        const childrenEnd = this.addElements(childrenOf(node), parentEnd);
        siblingsEnd = Math.max(
          siblingsEnd,
          endOf(node, contentStart),
          childrenEnd
        );
      }
    });

    return siblingsEnd;
  }

  /** Adds `element` after the elements inside it; returns where it ends. */
  private addElement(element: ElementNode, nextSiblingStart: number): number {
    const { contentStart, isPug } = this.template;
    const structural = this.structuralAttributes.get(element) ?? [];
    const ownAttributes = element.props.map((prop) =>
      sourceAttribute(prop, contentStart)
    );
    const attributes = [...ownAttributes, ...structural];

    const attributeEnds = attributes.map(({ end }) => end);
    const ownEnd = Math.max(endOf(element, contentStart), ...attributeEnds);

    // Pug has no closing tags: an element's content runs to its next sibling.
    const contentBound = isPug ? nextSiblingStart : ownEnd;
    const childrenEnd = this.addElements(element.children, contentBound);
    const end = Math.max(ownEnd, childrenEnd, contentBound);

    const hasKnownStart = element.loc.start.offset >= 0;
    if (hasKnownStart)
      this.elements.push(
        this.sourceElement(element, end, attributes, structural)
      );

    return end;
  }

  private nextSiblingStart(
    siblings: readonly TemplateChildNode[],
    index: number,
    parentEnd: number
  ): number {
    const laterSiblings = siblings.slice(index + 1);
    const nextSibling = laterSiblings.find(
      (sibling) => sibling.loc.start.offset >= 0
    );

    return nextSibling
      ? this.template.contentStart + nextSibling.loc.start.offset
      : parentEnd;
  }

  private sourceElement(
    element: ElementNode,
    end: number,
    attributes: readonly SourceAttribute[],
    structural: readonly SourceAttribute[]
  ): SourceElement {
    const { source } = this;
    const { contentStart, isPug } = this.template;
    const tagStart = contentStart + element.loc.start.offset;
    const nameStart = source[tagStart] === '<' ? tagStart + 1 : tagStart;
    const nameEnd = nameStart + element.tag.length;

    const attributeEnds = [
      ...element.props.map((prop) => contentStart + prop.loc.end.offset),
      // A structural attribute's range is its value: its closing quote follows.
      ...structural.map((attribute) => attribute.end + 1),
    ];
    const openEnd = isPug
      ? Math.max(nameEnd, ...attributeEnds)
      : openingTagEnd(source, nameEnd, attributeEnds);

    return {
      name: element.tag,
      start: nameEnd,
      end,
      nameStart,
      nameEnd,
      openEnd,
      component: element.tagType === COMPONENT_TAG,
      attributes,
    };
  }
}

/**
 * Vue's compiler moves `v-if`, `v-else-if` and `v-for` off their element, onto
 * the `IF` branch or `FOR` node that wraps it.
 */
function structuralAttributesByElement(
  ast: RootNode,
  contentStart: number,
  source: string
): Map<ElementNode, SourceAttribute[]> {
  const attributes = new Map<ElementNode, SourceAttribute[]>();

  const add = (
    wrapped: readonly TemplateChildNode[],
    attribute: SourceAttribute | undefined
  ) => {
    const [element] = wrapped;
    if (!attribute || wrapped.length !== 1 || element?.type !== ELEMENT) return;

    const existing = attributes.get(element) ?? [];
    attributes.set(element, [...existing, attribute]);
  };

  const visit = (node: TemplateChildNode) => {
    if (node.type === IF) {
      for (const branch of node.branches) {
        add(branch.children, conditionAttribute(branch, contentStart, source));
      }
    } else if (node.type === FOR) {
      add(node.children, loopAttribute(node, contentStart));
    }

    childrenOf(node).forEach(visit);
  };

  ast.children.forEach(visit);

  return attributes;
}

function conditionAttribute(
  branch: IfBranchNode,
  contentStart: number,
  source: string
): SourceAttribute | undefined {
  const condition = branch.condition?.loc;
  if (!condition || condition.start.offset < 0) return undefined;

  const { start, end } = fileRange(condition, contentStart);
  const textBefore = source.slice(0, start);
  const name = /(v-(?:else-)?if)\s*=\s*["']?\s*$/.exec(textBefore)?.[1];

  return name ? { name, start, end } : undefined;
}

/** The node's location is the whole `v-for="…"` attribute; the value is inside its quotes. */
function loopAttribute(
  { loc }: ForNode,
  contentStart: number
): SourceAttribute | undefined {
  const untilValue = /^v-for\s*=\s*["']/.exec(loc.source);
  if (!untilValue || loc.start.offset < 0) return undefined;

  const { start, end } = fileRange(loc, contentStart);
  const valueStart = start + untilValue[0].length;
  const valueEnd = end - 1;

  return { name: 'v-for', start: valueStart, end: valueEnd };
}

function sourceAttribute(
  prop: AttributeNode | DirectiveNode,
  contentStart: number
) {
  const value = prop.type === ATTRIBUTE ? prop.value : prop.exp;
  const location = value?.loc ?? prop.loc;

  return { name: writtenName(prop), ...fileRange(location, contentStart) };
}

/** `:title` and `@click`, not the directives' normalized `bind` and `on`. */
function writtenName(prop: AttributeNode | DirectiveNode): string {
  if (prop.type === ATTRIBUTE) return prop.name;

  return prop.rawName ?? prop.loc.source.split(/[=\s]/, 1)[0]!;
}

function expressionLocations(
  node: TemplateChildNode
): Array<SourceLocation | undefined> {
  if (node.type === INTERPOLATION) return [node.content.loc];
  if (node.type === ELEMENT) return node.props.flatMap(directiveLocations);

  return [];
}

function directiveLocations(
  prop: AttributeNode | DirectiveNode
): Array<SourceLocation | undefined> {
  if (prop.type !== DIRECTIVE) return [];

  const { exp, arg } = prop;
  if (arg && !isStatic(arg)) return [exp?.loc, arg.loc];

  return [exp?.loc];
}

function hasKnownText(
  location: SourceLocation | undefined
): location is SourceLocation {
  return (
    !!location &&
    location.start.offset >= 0 &&
    location.end.offset > location.start.offset
  );
}

function isStatic(expression: ExpressionNode): boolean {
  return 'isStatic' in expression && expression.isStatic;
}

/** Pug leaves some offsets unknown (-1): a node ends at the furthest one that is known. */
function endOf(node: TemplateChildNode, contentStart: number): number {
  const ownEnd =
    contentStart + Math.max(node.loc.start.offset, node.loc.end.offset);
  const content = 'content' in node ? node.content : undefined;
  const contentLocation =
    typeof content === 'string' ? undefined : content?.loc;
  if (!contentLocation) return ownEnd;

  return Math.max(ownEnd, contentStart + contentLocation.end.offset);
}

function childrenOf(node: TemplateChildNode): readonly TemplateChildNode[] {
  if (node.type === ELEMENT || node.type === FOR) return node.children;
  if (node.type === IF)
    return node.branches.flatMap((branch) => branch.children);

  return [];
}

function fileRange(
  location: SourceLocation,
  contentStart: number
): SourceRange {
  return {
    start: contentStart + location.start.offset,
    end: contentStart + location.end.offset,
  };
}
