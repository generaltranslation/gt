import type * as AngularCompiler from '@angular/compiler';
import type { SourceAttribute, SourceElement } from '../elements.js';
import { GeneratedCode, lexerRange } from './generated-code.js';

type Compiler = typeof AngularCompiler;
type Expression = AngularCompiler.AST;
type BoundTemplate = AngularCompiler.BoundTarget<AngularCompiler.DirectiveMeta>;
type VariableRead =
  | AngularCompiler.PropertyRead
  | AngularCompiler.SafePropertyRead;

// Properties of Angular's nodes that hold positions or metadata, not children.
const NOT_CHILDREN = new Set([
  'sourceSpan',
  'startSourceSpan',
  'endSourceSpan',
  'keySpan',
  'valueSpan',
  'nameSpan',
  'tagSpan',
  'whenOrOnSourceSpan',
  'prefetchSpan',
  'hydrateSpan',
  'mainBlockSpan',
  'i18n',
  'span',
]);

export type TemplateRange = {
  start: number;
  end: number;
  /** The template is a JavaScript string literal's content, with its escapes. */
  escapedString?: boolean;
};

/**
 * Writes every expression of the template `source[range]` (by default the whole
 * source) as a statement of `generated`, and returns the template's elements.
 * Throws when Angular rejects the markup, e.g. an unclosed block or element.
 */
export function writeTemplate(
  compiler: Compiler,
  generated: GeneratedCode,
  file: string,
  range: TemplateRange = { start: 0, end: generated.source.length }
): SourceElement[] {
  const { source } = generated;
  const options = {
    range: lexerRange(source, range.start, range.end),
    escapedString: range.escapedString ?? false,
    preserveLineEndings: true,
  };

  const html = new compiler.HtmlParser().parse(source, file, {
    ...options,
    tokenizeExpansionForms: true,
    tokenizeBlocks: true,
    tokenizeLet: true,
  });
  const [markupError] = html.errors;
  if (markupError) {
    throw new Error(`Angular rejected the template: ${markupError.msg}`);
  }

  const template = compiler.parseTemplate(source, file, {
    ...options,
    preserveWhitespaces: true,
    enableBlockSyntax: true,
    enableLetSyntax: true,
  });
  const bound = new compiler.R3TargetBinder(null).bind({
    template: template.nodes,
  });

  const writer = new ExpressionWriter(compiler, generated, bound);
  forEachExpression(compiler, template.nodes, (expression) =>
    writer.write(expression)
  );

  return sourceElements(compiler, html.rootNodes);
}

class ExpressionWriter {
  constructor(
    private readonly compiler: Compiler,
    private readonly generated: GeneratedCode,
    private readonly bound: BoundTemplate
  ) {}

  write(expression: Expression): void {
    const { compiler } = this;

    if (expression instanceof compiler.ASTWithSource) {
      const isUnparsable = expression.errors.length > 0;
      if (!isUnparsable) this.write(expression.ast);

      return;
    }

    if (expression instanceof compiler.EmptyExpr) return;

    if (
      expression instanceof compiler.Interpolation ||
      expression instanceof compiler.Chain
    ) {
      return this.writeAll(expression.expressions);
    }

    if (!this.containsPipe(expression)) return this.copy(expression);

    // Pipes are Angular syntax: of `value | pipe:argument`, the value and the argument are written.
    if (expression instanceof compiler.BindingPipe) {
      this.write(expression.exp);
      return this.writeAll(expression.args);
    }

    this.writeAll(childExpressions(compiler, expression));
  }

  private writeAll(expressions: readonly Expression[]): void {
    for (const expression of expressions) this.write(expression);
  }

  /** Template variables are parameters of an arrow around the copy: they shadow other names. */
  private copy(expression: Expression): void {
    const { start, end } = expression.sourceSpan;
    if (end <= start) return;

    const variables = this.templateVariables(expression);
    const isArrow = variables.length > 0;
    const opening = isArrow ? `;((${variables.join(', ')}) => (` : ';(';
    const closing = isArrow ? '\n));\n' : '\n);\n';

    this.generated.glue(opening);
    this.generated.copy(start, end);
    this.generated.glue(closing);
  }

  private containsPipe(expression: Expression): boolean {
    return (
      expression instanceof this.compiler.BindingPipe ||
      childExpressions(this.compiler, expression).some((child) =>
        this.containsPipe(child)
      )
    );
  }

  /** The names `expression` reads that are `let-x`, `@for (x of …)`, `as x`, `#ref` or `@let`. */
  private templateVariables(expression: Expression): string[] {
    const { compiler } = this;
    const names = new Set<string>();

    const visit = (node: Expression) => {
      const isImplicitRead =
        (node instanceof compiler.PropertyRead ||
          node instanceof compiler.SafePropertyRead) &&
        node.receiver instanceof compiler.ImplicitReceiver &&
        !(node.receiver instanceof compiler.ThisReceiver);
      if (isImplicitRead && this.isTemplateVariable(node)) names.add(node.name);

      childExpressions(compiler, node).forEach(visit);
    };

    visit(expression);

    return [...names];
  }

  private isTemplateVariable(read: VariableRead): boolean {
    const target = this.bound.getExpressionTarget(read);
    if (target === null) return false;

    // The binder resolves every read of a `@let`'s name in its view to it, but
    // Angular rejects a read before the declaration.
    if (target instanceof this.compiler.TmplAstLetDeclaration) {
      return target.sourceSpan.start.offset < read.sourceSpan.start;
    }

    return true;
  }
}

function forEachExpression(
  compiler: Compiler,
  templateNodes: unknown,
  visit: (expression: Expression) => void
): void {
  // Angular's nodes refer to each other: each object is visited once.
  const seen = new Set<object>();

  const walk = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    seen.add(value);

    if (value instanceof compiler.AST) return visit(value);
    if (Array.isArray(value)) return value.forEach(walk);

    for (const [key, child] of Object.entries(value)) {
      if (!NOT_CHILDREN.has(key)) walk(child);
    }
  };

  walk(templateNodes);
}

function sourceElements(
  compiler: Compiler,
  nodes: readonly AngularCompiler.Node[]
): SourceElement[] {
  const elements: SourceElement[] = [];

  const visit = (node: AngularCompiler.Node) => {
    if (node instanceof compiler.Element) {
      elements.push(sourceElement(node));
      node.children.forEach(visit);
    } else if (node instanceof compiler.Block) {
      node.children.forEach(visit);
    } else if (node instanceof compiler.Expansion) {
      for (const expansionCase of node.cases)
        expansionCase.expression.forEach(visit);
    }
  };

  nodes.forEach(visit);

  return elements;
}

function sourceElement(element: AngularCompiler.Element): SourceElement {
  // `:svg:text` → `text`
  const name = element.name.replace(/^:[^:]+:/, '');
  const nameStart = element.startSourceSpan.start.offset + 1;
  const nameEnd = nameStart + name.length;
  const lastSpan = element.endSourceSpan ?? element.sourceSpan;

  return {
    name,
    start: nameEnd,
    end: lastSpan.end.offset,
    nameStart,
    nameEnd,
    openEnd: element.startSourceSpan.end.offset,
    component: false,
    attributes: element.attrs.map((attribute) => sourceAttribute(attribute)),
  };
}

function sourceAttribute(
  attribute: AngularCompiler.Attribute
): SourceAttribute {
  const span = attribute.valueSpan ?? attribute.sourceSpan;

  return {
    name: attribute.name,
    start: span.start.offset,
    end: span.end.offset,
  };
}

function childExpressions(
  compiler: Compiler,
  expression: Expression
): Expression[] {
  const children: Expression[] = [];

  for (const [key, value] of Object.entries(expression)) {
    if (NOT_CHILDREN.has(key)) continue;

    const values: unknown[] = Array.isArray(value) ? value : [value];
    const expressions = values.filter((child) => child instanceof compiler.AST);

    children.push(...expressions);
  }

  return children;
}
