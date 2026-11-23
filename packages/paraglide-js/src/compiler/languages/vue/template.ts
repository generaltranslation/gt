import type {
  AttributeNode,
  DirectiveNode,
  ExpressionNode,
  RootNode,
  SourceLocation,
  TemplateChildNode,
} from '@vue/compiler-dom';
import type { SourceRange } from '../../analysis/types.js';

// Values of @vue/compiler-core's `NodeTypes`. The compiler is the project's own,
// so only its types are imported.
const ELEMENT = 1;
const INTERPOLATION = 5;
const DIRECTIVE = 7;
const IF = 9;
const FOR = 11;

/** The SFC's `template.ast`. Its offsets are relative to `contentStart`. */
export type ParsedTemplate = {
  ast: RootNode;
  contentStart: number;
};

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
