import { forEachNode, type ESTree } from '../../utils/ast.js';
import type { SourceRange } from '../../analysis/types.js';
import { applyEdits, type Edit } from '../edits.js';
import type { ParseLang } from '../language.js';
import { sourceOffsets, UNMAPPED, type Mapping } from '../mapping.js';
import { parseSkippingUnparsable } from '../recover.js';

/** The tool reads names that are not setup bindings (props, the Options API's) through it. */
export const COMPONENT_INSTANCE = '__VLS_ctx';

/** Makes `@vue/language-core`'s code read like the template it was generated from. */
export function normalizeVueCode(
  file: string,
  code: string,
  lang: ParseLang,
  mappings: readonly Mapping[],
  expressions: readonly SourceRange[],
  source: string
): { code: string; mappings: Mapping[] } {
  const recovered = parseSkippingUnparsable(file, code, lang, mappings, {
    expressions,
  });
  if (!recovered.program)
    return { code: recovered.code, mappings: [...mappings] };

  const sourceAt = sourceOffsets(mappings, code.length);
  const template = new TemplateText(sourceAt, source);
  const edits: Edit[] = [];

  forEachNode(recovered.program, (node) =>
    edits.push(...editsFor(node, template))
  );

  return applyEdits(recovered.code, mappings, edits);
}

/** Which generated text is copied from the file, and what the file says there. */
class TemplateText {
  constructor(
    private readonly sourceAt: Int32Array,
    private readonly source: string
  ) {}

  isCopied(generatedOffset: number): boolean {
    return this.sourceAt[generatedOffset] !== UNMAPPED;
  }

  /**
   * The name Vue resolves a tag to, from the tool's reference to it:
   * `ParaglideMessage` from the `paraglideMessage` it writes for `<paraglide-message>`.
   */
  componentName(reference: ESTree.IdentifierReference): string | undefined {
    if (!this.isCopied(reference.start)) return undefined;

    const sourceStart = this.sourceAt[reference.start];
    const tag = /^[\w-]+/.exec(this.source.slice(sourceStart))?.[0] ?? '';
    const isKebabCase = tag.includes('-') && camelize(tag) === reference.name;

    return isKebabCase ? capitalize(reference.name) : reference.name;
  }
}

function editsFor(node: ESTree.Node, template: TemplateText): Edit[] {
  switch (node.type) {
    case 'Program':
    case 'BlockStatement':
      return componentDeclarations(node.body, template);
    case 'ExpressionStatement':
      return [
        ...dotValueDeclaration(node),
        ...kebabCaseTag(node.expression, template),
      ];
    case 'CallExpression':
      return unwrapCall(node);
    case 'MemberExpression':
      return [
        ...insertedDotValue(node, template),
        ...componentInstanceRead(node, template),
      ];
    default:
      return [];
  }
}

/**
 * `let __VLS_0!: T; MessageView;` → `const __VLS_0 = MessageView; MessageView;`
 *
 * The tool types a component it cannot see imported (auto-imported, global) by
 * name only; its props' call sites need the name, as for an imported component.
 */
function componentDeclarations(
  statements: ReadonlyArray<ESTree.Statement | ESTree.Directive>,
  template: TemplateText
): Edit[] {
  return statements.flatMap((statement, index) =>
    componentDeclaration(statement, statements[index + 1], template)
  );
}

function componentDeclaration(
  statement: ESTree.Statement | ESTree.Directive,
  next: ESTree.Statement | ESTree.Directive | undefined,
  template: TemplateText
): Edit[] {
  const variable = valuelessToolVariable(statement);
  if (!variable || template.isCopied(statement.start)) return [];

  if (
    next?.type !== 'ExpressionStatement' ||
    next.expression.type !== 'Identifier'
  )
    return [];

  const component = template.componentName(next.expression);
  if (!component) return [];

  const declaration = `const ${variable} = ${component};`;

  return [{ start: statement.start, end: statement.end, text: declaration }];
}

// `let __VLS_0!: T;` (TypeScript) or `var __VLS_0 = /** @type {T} */ ({});` (JavaScript)
function valuelessToolVariable(
  statement: ESTree.Statement | ESTree.Directive
): string | undefined {
  if (
    statement.type !== 'VariableDeclaration' ||
    statement.declarations.length !== 1
  ) {
    return undefined;
  }

  const [declarator] = statement.declarations;
  if (
    declarator?.id.type !== 'Identifier' ||
    !declarator.id.name.startsWith('__VLS_')
  ) {
    return undefined;
  }

  const init = declarator.init && withoutParentheses(declarator.init);
  const hasValue =
    init && (init.type !== 'ObjectExpression' || init.properties.length > 0);

  return hasValue ? undefined : declarator.id.name;
}

/** `__VLS_withDotValue(m, …);` only declares `m.value` for type checking. */
function dotValueDeclaration(statement: ESTree.ExpressionStatement): Edit[] {
  if (!isCallTo(statement.expression, '__VLS_withDotValue')) return [];

  return [{ start: statement.start, end: statement.end }];
}

/** `paraglideMessage;` (for `<paraglide-message>`) → `ParaglideMessage;` */
function kebabCaseTag(
  expression: ESTree.Expression,
  template: TemplateText
): Edit[] {
  if (expression.type !== 'Identifier') return [];

  const component = template.componentName(expression);
  if (!component || component === expression.name) return [];

  // Only the first letter: the tool maps the name in parts (`paraglide`, `Message`).
  const { start } = expression;

  return [{ start, end: start + 1, text: component.charAt(0) }];
}

/** `__VLS_unwrap(setLocale, {} as Ref<unknown>)` → `setLocale` */
function unwrapCall(call: ESTree.CallExpression): Edit[] {
  const [value] = call.arguments;
  if (
    !isCallTo(call, '__VLS_unwrap') ||
    !value ||
    value.type === 'SpreadElement'
  )
    return [];

  return [
    { start: call.start, end: value.start },
    { start: value.end, end: call.end },
  ];
}

/** `m.value.title()` → `m.title()`: the tool reads setup bindings as if they were refs. */
function insertedDotValue(
  member: ESTree.MemberExpression,
  template: TemplateText
): Edit[] {
  const { object, property } = member;
  const isInserted =
    !member.computed &&
    property.type === 'Identifier' &&
    property.name === 'value' &&
    !template.isCopied(property.start) &&
    template.isCopied(object.start);

  return isInserted ? [{ start: object.end, end: member.end }] : [];
}

/** `__VLS_ctx.message()` → `message()` */
function componentInstanceRead(
  member: ESTree.MemberExpression,
  template: TemplateText
): Edit[] {
  const { object, property } = member;
  const isRead =
    !member.computed &&
    object.type === 'Identifier' &&
    object.name === COMPONENT_INSTANCE &&
    !template.isCopied(object.start) &&
    template.isCopied(property.start);

  return isRead ? [{ start: object.start, end: property.start }] : [];
}

/** `paraglide-message` → `paraglideMessage` */
function camelize(tag: string): string {
  return tag.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function withoutParentheses(expression: ESTree.Expression): ESTree.Expression {
  return expression.type === 'ParenthesizedExpression'
    ? withoutParentheses(expression.expression)
    : expression;
}

function isCallTo(
  node: ESTree.Node,
  name: string
): node is ESTree.CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === name
  );
}
