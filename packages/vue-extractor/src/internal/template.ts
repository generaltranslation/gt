import { parseExpression, type ParserPlugin } from '@babel/parser';
import traverseModule, { type Scope } from '@babel/traverse';
import * as babel from '@babel/types';
import type {
  DirectiveNode,
  ElementNode,
  ExpressionNode,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode,
} from '@vue/compiler-dom';
import {
  HTML_CONTENT_PROPS,
  type GTProp,
  type JsxChild,
  type JsxChildren,
} from '@generaltranslation/format/types';
import { isAcceptedPluralForm } from 'generaltranslation/internal';
import { ElementTypes, NodeTypes } from './compilerAst.js';
import { processVueStringCall } from './stringCalls.js';
import type {
  ExtractionLocation,
  GTComponentName,
  TemplateBindings,
  VueExtractionContext,
} from './types.js';
import {
  addVueError,
  createInlineMetadata,
  readStaticPrimitive,
  type StaticPrimitive,
  unwrapExpression,
} from './utils.js';

const traverse = traverseModule.default || traverseModule;

type Counter = { value: number };

type SlotContent = {
  children: TemplateChildNode[];
  shadowed: Set<string>;
};

type SlotLayout = {
  defaultSlot: SlotContent;
  namedSlots: Map<string, SlotContent>;
};

type ForParseResult = {
  index?: SimpleExpressionNode;
  key?: SimpleExpressionNode;
  source?: SimpleExpressionNode;
  value?: SimpleExpressionNode;
};

const NON_BRANCH_ATTRIBUTE_NAMES = new Set([
  'branch',
  'class',
  'n',
  'locales',
  'key',
  'ref',
  'ref_for',
  'ref_key',
  'ref-for',
  'ref-key',
  'style',
]);

const RESERVED_T_PROPS = new Set([
  'key',
  'ref',
  'ref_for',
  'ref_key',
  'ref-for',
  'ref-key',
]);

const SOURCE_SHAPING_DIRECTIVES = new Set([
  'if',
  'else',
  'else-if',
  'for',
  'html',
  'text',
]);

export function parseVueTemplate(
  root: RootNode,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): void {
  visitTemplateChildren(
    root.children,
    new Set(),
    bindings,
    expressionPlugins,
    context,
    false
  );
}

function visitTemplateChildren(
  children: TemplateChildNode[],
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext,
  insideTranslation: boolean
): void {
  for (const child of children) {
    if (child.type === NodeTypes.INTERPOLATION) {
      processTemplateExpression(
        child.content,
        shadowed,
        bindings,
        expressionPlugins,
        context
      );
      continue;
    }
    if (child.type !== NodeTypes.ELEMENT) continue;

    const localBindings = collectElementScopeBindings(child, expressionPlugins);
    const childShadowed = unionSets(shadowed, localBindings);

    for (const property of child.props) {
      if (property.type !== NodeTypes.DIRECTIVE) continue;
      if (property.name === 'for') {
        const parseResult = (
          property as DirectiveNode & { forParseResult?: ForParseResult }
        ).forParseResult;
        for (const alias of [
          parseResult?.value,
          parseResult?.key,
          parseResult?.index,
        ]) {
          processBindingDefaults(
            alias,
            childShadowed,
            bindings,
            expressionPlugins,
            context
          );
        }
      } else if (property.name === 'slot') {
        processBindingDefaults(
          property.exp,
          childShadowed,
          bindings,
          expressionPlugins,
          context
        );
      }
    }

    for (const property of child.props) {
      if (property.type !== NodeTypes.DIRECTIVE) continue;
      if (
        property.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
        !property.arg.isStatic
      ) {
        processTemplateExpression(
          property.arg,
          childShadowed,
          bindings,
          expressionPlugins,
          context
        );
      }
      if (property.name === 'slot' || !property.exp) continue;
      if (property.name === 'for') {
        const parseResult = (
          property as DirectiveNode & { forParseResult?: ForParseResult }
        ).forParseResult;
        if (parseResult?.source) {
          processTemplateExpression(
            parseResult.source,
            shadowed,
            bindings,
            expressionPlugins,
            context
          );
        }
        continue;
      }
      processTemplateExpression(
        property.exp,
        property.name === 'if' || property.name === 'else-if'
          ? shadowed
          : childShadowed,
        bindings,
        expressionPlugins,
        context
      );
    }

    const component = resolveGTComponent(
      child,
      bindings,
      expressionPlugins,
      childShadowed
    );
    if (component?.originalName === 'T' && !insideTranslation) {
      extractTranslationComponent(
        child,
        childShadowed,
        bindings,
        expressionPlugins,
        context
      );
    }

    visitTemplateChildren(
      child.children,
      childShadowed,
      bindings,
      expressionPlugins,
      context,
      component?.originalName === 'Var'
        ? false
        : insideTranslation || component?.originalName === 'T'
    );
  }
}

function processTemplateExpression(
  expression: ExpressionNode,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): void {
  const expressionNode = getExpressionNode(expression, expressionPlugins);
  if (!expressionNode) return;

  processTemplateExpressionNode(
    expressionNode,
    expression.loc,
    shadowed,
    bindings,
    context
  );
}

function processTemplateExpressionNode(
  expression: babel.Node,
  location: ExtractionLocation,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  context: VueExtractionContext
): void {
  const file = wrapForTraversal(expression);
  if (!file) return;

  traverse(file, {
    CallExpression(path) {
      const kind = resolveTemplateStringFunction(
        path.node.callee,
        path.scope,
        shadowed,
        bindings
      );
      if (!kind) return;
      processVueStringCall(path.node, kind, location, context, (node) =>
        readTemplatePrimitive(node, path.scope, shadowed, bindings)
      );
    },
    OptionalCallExpression(path) {
      const kind = resolveTemplateStringFunction(
        path.node.callee,
        path.scope,
        shadowed,
        bindings
      );
      if (!kind) return;
      processVueStringCall(path.node, kind, location, context, (node) =>
        readTemplatePrimitive(node, path.scope, shadowed, bindings)
      );
    },
    TaggedTemplateExpression(path) {
      const kind = resolveTemplateStringFunction(
        path.node.tag,
        path.scope,
        shadowed,
        bindings
      );
      if (!kind) return;
      addVueError(
        context,
        location,
        'Found an unsupported tagged template translation in gt-vue',
        'Call the translation function with a string literal instead'
      );
    },
  });
}

/** Reads a script-exposed primitive unless a Vue or expression scope masks it. */
function readTemplatePrimitive(
  input: babel.Node | null | undefined,
  scope: Scope,
  shadowed: Set<string>,
  bindings: TemplateBindings
) {
  return readStaticPrimitive(input, (identifier) => {
    if (shadowed.has(identifier.name) || scope.hasBinding(identifier.name)) {
      return { ok: false };
    }
    const value = bindings.staticValues.get(identifier.name);
    return bindings.staticValues.has(identifier.name)
      ? { ok: true, value: value! }
      : { ok: false };
  });
}

/** Resolves a template call back to a statically imported gt-vue function. */
function resolveTemplateStringFunction(
  input: babel.Node,
  scope: Scope,
  shadowed: Set<string>,
  bindings: TemplateBindings
) {
  const node = unwrapExpression(input);
  if (!node) return undefined;

  if (node.type === 'Identifier') {
    if (shadowed.has(node.name) || scope.hasBinding(node.name))
      return undefined;
    return bindings.stringFunctions.get(node.name);
  }
  if (
    node.type !== 'MemberExpression' &&
    node.type !== 'OptionalMemberExpression'
  ) {
    return undefined;
  }
  const object = unwrapExpression(node.object);
  if (object?.type !== 'Identifier') return undefined;
  if (shadowed.has(object.name) || scope.hasBinding(object.name)) {
    return undefined;
  }
  const property =
    !node.computed && node.property.type === 'Identifier'
      ? node.property.name
      : node.computed && node.property.type === 'StringLiteral'
        ? node.property.value
        : undefined;
  return property
    ? bindings.stringFunctions.get(`${object.name}.${property}`)
    : undefined;
}

/** Visits expressions that execute while Vue initializes binding patterns. */
function processBindingDefaults(
  expression: ExpressionNode | undefined,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): void {
  if (
    !expression ||
    expression.type !== NodeTypes.SIMPLE_EXPRESSION ||
    !expression.content
  ) {
    return;
  }
  try {
    const arrow = parseExpression(`(${expression.content}) => 0`, {
      plugins: expressionPlugins,
    });
    if (arrow.type !== 'ArrowFunctionExpression') return;
    for (const parameter of arrow.params) {
      visitBindingDefaultExpressions(parameter, (node) =>
        processTemplateExpressionNode(
          node,
          expression.loc,
          shadowed,
          bindings,
          context
        )
      );
    }
  } catch {
    // The Vue compiler reports malformed v-for/v-slot bindings separately.
  }
}

/** Recursively finds default and computed-key expressions in a binding. */
function visitBindingDefaultExpressions(
  pattern: babel.Node | null,
  visit: (expression: babel.Expression) => void
): void {
  if (!pattern) return;
  if (pattern.type === 'AssignmentPattern') {
    visit(pattern.right);
    visitBindingDefaultExpressions(pattern.left, visit);
  } else if (pattern.type === 'RestElement') {
    visitBindingDefaultExpressions(pattern.argument, visit);
  } else if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) visitBindingDefaultExpressions(element, visit);
    }
  } else if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        visitBindingDefaultExpressions(property.argument, visit);
      } else {
        if (property.computed && babel.isExpression(property.key)) {
          visit(property.key);
        }
        visitBindingDefaultExpressions(property.value, visit);
      }
    }
  } else if (pattern.type === 'TSParameterProperty') {
    visitBindingDefaultExpressions(pattern.parameter, visit);
  }
}

function extractTranslationComponent(
  element: ElementNode,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): void {
  const errorCount = context.errors.length;
  const translationContext = readTContext(
    element,
    shadowed,
    bindings,
    expressionPlugins,
    context
  );
  const slots = getSlotLayout(element, shadowed, expressionPlugins, context);
  if (slots.namedSlots.size > 0) {
    addVueError(
      context,
      element.loc,
      'Found a named slot on a gt-vue <T> component',
      'Place translatable content in the default slot'
    );
  }

  const counter = { value: 0 };
  const serialized = serializeChildren(
    slots.defaultSlot.children,
    counter,
    slots.defaultSlot.shadowed,
    bindings,
    expressionPlugins,
    context
  );
  if (context.errors.length !== errorCount) return;

  context.results.push({
    dataFormat: 'JSX',
    source: collapseChildren(serialized),
    metadata: createInlineMetadata(context, element.loc, translationContext),
  });
}

function readTContext(
  element: ElementNode,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): string | undefined {
  let translationContext: string | undefined;
  let hasContext = false;

  for (const property of element.props) {
    if (isDynamicComponentSelector(element, property)) continue;
    if (property.type === NodeTypes.ATTRIBUTE) {
      if (RESERVED_T_PROPS.has(property.name)) continue;
      if (property.name !== 'context' && property.name !== '$context') {
        addVueError(
          context,
          property.loc,
          `Found unsupported prop "${property.name}" on a gt-vue <T> component`,
          'gt-vue <T> currently supports only context'
        );
        continue;
      }
      if (hasContext) {
        addDuplicateContextError(property.loc, context);
        continue;
      }
      hasContext = true;
      translationContext = property.value?.content ?? '';
      continue;
    }

    if (property.name !== 'bind') continue;
    if (property.modifiers.length > 0) {
      const directive = property.rawName ?? 'v-bind';
      addVueError(
        context,
        property.loc,
        `Found unsupported directive ${directive} on a gt-vue <T> component`,
        'Pass context without a v-bind modifier'
      );
      continue;
    }
    const key = readDirectiveKey(property);
    if (!key) {
      addVueError(
        context,
        property.loc,
        'Found a dynamic or spread binding on a gt-vue <T> component',
        'Pass context as a static context or $context prop'
      );
      continue;
    }
    if (RESERVED_T_PROPS.has(key)) continue;
    if (key !== 'context' && key !== '$context') {
      addVueError(
        context,
        property.loc,
        `Found unsupported prop "${key}" on a gt-vue <T> component`,
        'gt-vue <T> currently supports only context'
      );
      continue;
    }
    if (hasContext) {
      addDuplicateContextError(property.loc, context);
      continue;
    }
    hasContext = true;
    const value = readExpressionPrimitive(
      property.exp,
      expressionPlugins,
      shadowed,
      bindings
    );
    if (!value.ok || typeof value.value !== 'string') {
      addVueError(
        context,
        property.loc,
        'Found a dynamic context on a gt-vue <T> component',
        'Use a string literal or a template literal without expressions'
      );
      continue;
    }
    translationContext = value.value;
  }
  return translationContext;
}

function addDuplicateContextError(
  location: ExtractionLocation,
  context: VueExtractionContext
): void {
  addVueError(
    context,
    location,
    'Found duplicate context props on a gt-vue <T> component',
    'Pass only one context prop'
  );
}

function serializeChildren(
  children: TemplateChildNode[],
  counter: Counter,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): JsxChild[] {
  const result: JsxChild[] = [];
  for (const child of children) {
    const values = serializeChild(
      child,
      counter,
      shadowed,
      bindings,
      expressionPlugins,
      context
    );
    for (const value of values) appendSerializedChild(result, value);
  }
  return result;
}

function serializeChild(
  child: TemplateChildNode,
  counter: Counter,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): JsxChild[] {
  if (child.type === NodeTypes.COMMENT) return [];
  if (child.type === NodeTypes.TEXT) return [child.content];
  if (child.type === NodeTypes.INTERPOLATION) {
    const value = readExpressionPrimitive(
      child.content,
      expressionPlugins,
      shadowed,
      bindings
    );
    if (!value.ok) {
      addVueError(
        context,
        child.loc,
        'Found dynamic template content inside a gt-vue <T> component',
        'Wrap runtime values in <Var>, <Num>, <DateTime>, or <Currency>'
      );
      return [];
    }
    return [toDisplayString(value.value)];
  }
  if (child.type !== NodeTypes.ELEMENT) {
    addVueError(
      context,
      child.loc,
      'Found unsupported template syntax inside a gt-vue <T> component',
      'Use static template content and gt-vue rich translation components'
    );
    return [];
  }
  return [
    serializeElement(
      child,
      counter,
      shadowed,
      bindings,
      expressionPlugins,
      context
    ),
  ];
}

function serializeElement(
  element: ElementNode,
  counter: Counter,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): JsxChild {
  counter.value += 1;
  const id = counter.value;
  const component = resolveGTComponent(
    element,
    bindings,
    expressionPlugins,
    shadowed
  );
  validateRichElement(element, context, Boolean(component));
  const originalName = component?.originalName;

  if (originalName === 'T') {
    addVueError(
      context,
      element.loc,
      'Found a nested gt-vue <T> component inside another <T>',
      'Split nested translations into sibling <T> components'
    );
  }

  if (
    originalName === 'Var' ||
    originalName === 'Num' ||
    originalName === 'DateTime' ||
    originalName === 'Currency'
  ) {
    if (originalName === 'Var') validateVarProps(element, context);
    const variable =
      originalName === 'Num'
        ? { name: 'n', type: 'n' as const }
        : originalName === 'DateTime'
          ? { name: 'date', type: 'd' as const }
          : originalName === 'Currency'
            ? { name: 'cost', type: 'c' as const }
            : { name: 'value', type: 'v' as const };
    return {
      i: id,
      k: `_gt_${variable.name}_${id}`,
      v: variable.type,
    };
  }

  const data = readContentProps(
    element,
    shadowed,
    bindings,
    expressionPlugins,
    context
  );
  const slotLayout =
    element.tagType === ElementTypes.COMPONENT
      ? getSlotLayout(element, shadowed, expressionPlugins, context)
      : {
          defaultSlot: { children: element.children, shadowed },
          namedSlots: new Map<string, SlotContent>(),
        };

  const children = serializeChildren(
    slotLayout.defaultSlot.children,
    counter,
    slotLayout.defaultSlot.shadowed,
    bindings,
    expressionPlugins,
    context
  );

  if (
    slotLayout.namedSlots.size > 0 &&
    originalName !== 'Branch' &&
    originalName !== 'Plural'
  ) {
    addVueError(
      context,
      element.loc,
      `Found named slots on <${originalName ?? element.tag}> inside a gt-vue <T> component`,
      'Move named-slot content outside <T> or use only the component default slot'
    );
  }

  if (originalName === 'Branch' || originalName === 'Plural') {
    const branches = readBranches(
      element,
      slotLayout,
      id,
      originalName,
      shadowed,
      bindings,
      expressionPlugins,
      context
    );
    if (Object.keys(branches).length > 0) {
      data.b = branches;
      data.t = originalName === 'Plural' ? 'p' : 'b';
    }
  }

  return {
    t: originalName ?? element.tag,
    i: id,
    ...(Object.keys(data).length > 0 && { d: data }),
    ...(children.length > 0 && { c: collapseChildren(children) }),
  };
}

function validateRichElement(
  element: ElementNode,
  context: VueExtractionContext,
  resolvedDynamicComponent: boolean
): void {
  if (element.tagType === ElementTypes.SLOT || element.tag === 'slot') {
    addVueError(
      context,
      element.loc,
      'Found a <slot> inside a gt-vue <T> component',
      'Move runtime slot content outside <T> or wrap a stable value in <Var>'
    );
  }
  if (
    element.tag === 'template' &&
    !element.props.some(
      (property) =>
        property.type === NodeTypes.DIRECTIVE && property.name === 'slot'
    )
  ) {
    addVueError(
      context,
      element.loc,
      'Found a bare <template> inside a gt-vue <T> component',
      'Use an ordinary element or a statically named slot template'
    );
  }
  if (element.tag.toLowerCase() === 'component' && !resolvedDynamicComponent) {
    addVueError(
      context,
      element.loc,
      'Found a dynamic <component> inside a gt-vue <T> component',
      'Use a statically named element or component'
    );
  }

  for (const property of element.props) {
    if (property.type !== NodeTypes.DIRECTIVE) continue;
    if (SOURCE_SHAPING_DIRECTIVES.has(property.name)) {
      addVueError(
        context,
        property.loc,
        `Found source-shaping directive ${property.rawName ?? `v-${property.name}`} inside a gt-vue <T> component`,
        'Move conditional or repeated content outside <T>, or use Branch/Plural'
      );
    } else if (property.name === 'bind' && !readDirectiveKey(property)) {
      addVueError(
        context,
        property.loc,
        'Found a dynamic or spread v-bind inside a gt-vue <T> component',
        'Bind props by a static name so their effect on the translation source is known'
      );
    }
  }
}

function validateVarProps(
  element: ElementNode,
  context: VueExtractionContext
): void {
  for (const property of element.props) {
    const key =
      property.type === NodeTypes.ATTRIBUTE
        ? property.name
        : property.name === 'bind'
          ? readDirectiveKey(property)
          : undefined;
    if (key === 'name' || key === 'value') {
      addVueError(
        context,
        property.loc,
        `Found unsupported ${key} prop on a gt-vue <Var> component`,
        'Pass the variable as the default child of <Var>'
      );
    }
  }
}

function readContentProps(
  element: ElementNode,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): GTProp {
  const data: GTProp = {};
  for (const [shortName, propName] of Object.entries(HTML_CONTENT_PROPS)) {
    const property = findElementProperty(
      element,
      propName,
      expressionPlugins,
      shadowed,
      bindings
    );
    if (!property.present) continue;
    if (!property.static) {
      addVueError(
        context,
        property.location,
        `Found dynamic translatable prop "${propName}" inside a gt-vue <T> component`,
        'Use a string literal for translatable HTML props'
      );
      continue;
    }
    if (typeof property.value === 'string') {
      (data as Record<string, unknown>)[shortName] = property.value;
    }
  }
  return data;
}

function readBranches(
  element: ElementNode,
  slots: SlotLayout,
  branchElementId: number,
  component: 'Branch' | 'Plural',
  shadowed: Set<string>,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): Record<string, JsxChildren> {
  const branches: Record<string, JsxChildren> = {};

  for (const [name, slot] of slots.namedSlots) {
    if (name.startsWith('_')) continue;
    if (component === 'Plural' && !isAcceptedPluralForm(name)) continue;
    branches[name] = collapseChildren(
      serializeChildren(
        slot.children,
        { value: branchElementId },
        slot.shadowed,
        bindings,
        expressionPlugins,
        context
      )
    );
  }

  for (const property of element.props) {
    if (isDynamicComponentSelector(element, property)) continue;
    if (property.type === NodeTypes.DIRECTIVE && property.name === 'slot') {
      continue;
    }
    const key =
      property.type === NodeTypes.ATTRIBUTE
        ? property.name
        : readDirectiveKey(property);

    // Vue compiles v-on directives to listener props, which gt-vue always
    // excludes from branch content regardless of the handler expression.
    if (property.type === NodeTypes.DIRECTIVE && property.name === 'on') {
      continue;
    }
    if (
      key &&
      (!isBranchAttributeName(key) ||
        Object.prototype.hasOwnProperty.call(branches, key) ||
        (component === 'Plural' && !isAcceptedPluralForm(key)))
    ) {
      continue;
    }
    if (
      property.type === NodeTypes.DIRECTIVE &&
      (property.name !== 'bind' || property.modifiers.length > 0)
    ) {
      const directive = property.rawName ?? `v-${property.name}`;
      addVueError(
        context,
        property.loc,
        `Found unsupported directive ${directive} on a gt-vue <${component}> component`,
        `Move ${directive} to an element outside <${component}>`
      );
      continue;
    }
    if (!key) continue;
    const value = readPropertyValue(
      property,
      expressionPlugins,
      shadowed,
      bindings
    );
    if (!value.ok) {
      if (
        isStaticallyNonBranchValue(
          property,
          expressionPlugins,
          shadowed,
          bindings
        )
      ) {
        continue;
      }
      addVueError(
        context,
        property.loc,
        `Found dynamic branch prop "${key}" on a gt-vue <${component}> component`,
        'Use a static branch prop or a named slot'
      );
      continue;
    }
    branches[key] = branchPropToChildren(value.value);
  }
  return branches;
}

function branchPropToChildren(value: StaticPrimitive): JsxChildren {
  if (value == null || typeof value === 'boolean') return [];
  return String(value);
}

/**
 * Mirrors the attribute-name half of gt-vue's runtime branch predicate.
 *
 * Vue combines explicit component props, presentation attributes, and
 * normalized listeners in one VNode prop record. The extractor must discard
 * the same names before evaluating values so dynamic class/style/listener
 * expressions cannot change a published translation hash.
 */
function isBranchAttributeName(name: string): boolean {
  return !(
    NON_BRANCH_ATTRIBUTE_NAMES.has(name) ||
    name.startsWith('aria-') ||
    name.startsWith('data-') ||
    /^on[^a-z]/.test(name)
  );
}

/**
 * Identifies expressions whose top-level runtime type can never be branch
 * content. Unknown identifiers and calls deliberately return false so an
 * arbitrary prop whose runtime type may be primitive still fails closed.
 */
function isStaticallyNonBranchValue(
  property: ElementNode['props'][number],
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>,
  bindings: TemplateBindings
): boolean {
  if (property.type !== NodeTypes.DIRECTIVE || property.name !== 'bind') {
    return false;
  }
  const expression = property.exp
    ? getExpressionNode(property.exp, expressionPlugins)
    : undefined;
  const node = unwrapExpression(expression);
  if (!node) return false;

  if (babel.isIdentifier(node, { name: 'undefined' })) {
    return !shadowed.has(node.name) && !bindings.staticValues.has(node.name);
  }
  return (
    babel.isArrayExpression(node) ||
    babel.isArrowFunctionExpression(node) ||
    babel.isClassExpression(node) ||
    babel.isFunctionExpression(node) ||
    babel.isNewExpression(node) ||
    babel.isObjectExpression(node) ||
    babel.isRegExpLiteral(node) ||
    (babel.isUnaryExpression(node) && node.operator === 'void')
  );
}

function getSlotLayout(
  element: ElementNode,
  shadowed: Set<string>,
  expressionPlugins: ParserPlugin[],
  context: VueExtractionContext
): SlotLayout {
  const namedSlots = new Map<string, SlotContent>();
  let defaultSlot: SlotContent = { children: [], shadowed };
  let hasExplicitDefaultSlot = false;
  let reportedDefaultConflict = false;
  const componentSlot = element.props.find(
    (property): property is DirectiveNode =>
      property.type === NodeTypes.DIRECTIVE && property.name === 'slot'
  );

  if (componentSlot) {
    if (componentSlot.exp) addScopedSlotError(componentSlot.loc, context);
    const slotName = readSlotName(componentSlot, context);
    const slotShadowed = unionSets(
      shadowed,
      collectExpressionBindings(componentSlot.exp, expressionPlugins)
    );
    if (slotName === 'default') {
      defaultSlot = { children: element.children, shadowed: slotShadowed };
    } else if (slotName) {
      namedSlots.set(slotName, {
        children: element.children,
        shadowed: slotShadowed,
      });
    }
    return { defaultSlot, namedSlots };
  }

  const defaultChildren: TemplateChildNode[] = [];
  for (const child of element.children) {
    const slotDirective =
      child.type === NodeTypes.ELEMENT && child.tag === 'template'
        ? child.props.find(
            (property): property is DirectiveNode =>
              property.type === NodeTypes.DIRECTIVE && property.name === 'slot'
          )
        : undefined;
    if (!slotDirective || child.type !== NodeTypes.ELEMENT) {
      if (isRuntimeSlotContent(child)) defaultChildren.push(child);
      continue;
    }

    for (const property of child.props) {
      if (property.type === NodeTypes.DIRECTIVE && property.name !== 'slot') {
        addVueError(
          context,
          property.loc,
          'Found a conditional or dynamic named slot inside a gt-vue <T> component',
          'Use an unconditional, statically named slot'
        );
      }
    }

    const slotName = readSlotName(slotDirective, context);
    if (slotDirective.exp) addScopedSlotError(slotDirective.loc, context);
    const slotShadowed = unionSets(
      shadowed,
      collectExpressionBindings(slotDirective.exp, expressionPlugins)
    );
    if (slotName === 'default') {
      if (defaultChildren.length > 0 || hasExplicitDefaultSlot) {
        addVueError(
          context,
          child.loc,
          'Found more than one default slot definition inside a gt-vue translation',
          'Use a single default slot'
        );
        reportedDefaultConflict = true;
      }
      hasExplicitDefaultSlot = true;
      defaultSlot = { children: child.children, shadowed: slotShadowed };
    } else if (slotName) {
      if (namedSlots.has(slotName)) {
        addVueError(
          context,
          child.loc,
          `Found duplicate named slot "${slotName}" inside a gt-vue translation`,
          'Define each named slot once'
        );
      }
      namedSlots.set(slotName, {
        children: child.children,
        shadowed: slotShadowed,
      });
    }
  }

  if (
    hasExplicitDefaultSlot &&
    defaultChildren.length > 0 &&
    !reportedDefaultConflict
  ) {
    addVueError(
      context,
      defaultChildren[0].loc,
      'Found more than one default slot definition inside a gt-vue translation',
      'Use a single default slot'
    );
  } else if (!hasExplicitDefaultSlot && defaultChildren.length > 0) {
    defaultSlot = { children: defaultChildren, shadowed };
  }
  return { defaultSlot, namedSlots };
}

/** Matches Vue's omission of comments and whitespace-only implicit slots. */
function isRuntimeSlotContent(child: TemplateChildNode): boolean {
  if (child.type === NodeTypes.COMMENT) return false;
  return child.type !== NodeTypes.TEXT || child.content.trim().length > 0;
}

function addScopedSlotError(
  location: ExtractionLocation,
  context: VueExtractionContext
): void {
  addVueError(
    context,
    location,
    'Found a scoped slot inside a gt-vue <T> component',
    'Use a slot without runtime slot props so the translation source is static'
  );
}

function readSlotName(
  directive: DirectiveNode,
  context: VueExtractionContext
): string | undefined {
  if (!directive.arg) return 'default';
  if (
    directive.arg.type !== NodeTypes.SIMPLE_EXPRESSION ||
    !directive.arg.isStatic
  ) {
    addVueError(
      context,
      directive.loc,
      'Found a dynamic slot name inside a gt-vue translation',
      'Use a static slot name'
    );
    return undefined;
  }
  return directive.arg.content;
}

function findElementProperty(
  element: ElementNode,
  name: string,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>,
  bindings: TemplateBindings
):
  | { present: false }
  | {
      location: ExtractionLocation;
      present: true;
      static: boolean;
      value?: StaticPrimitive;
    } {
  for (const property of element.props) {
    const key =
      property.type === NodeTypes.ATTRIBUTE
        ? property.name
        : property.name === 'bind'
          ? readDirectiveKey(property)
          : undefined;
    if (key !== name) continue;
    const value = readPropertyValue(
      property,
      expressionPlugins,
      shadowed,
      bindings
    );
    return {
      location: property.loc,
      present: true,
      static: value.ok,
      ...(value.ok && { value: value.value }),
    };
  }
  return { present: false };
}

function readPropertyValue(
  property: ElementNode['props'][number],
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>,
  bindings: TemplateBindings
): { ok: true; value: StaticPrimitive } | { ok: false } {
  if (property.type === NodeTypes.ATTRIBUTE) {
    return { ok: true, value: property.value?.content ?? '' };
  }
  if (property.name !== 'bind') return { ok: false };
  return readExpressionPrimitive(
    property.exp,
    expressionPlugins,
    shadowed,
    bindings
  );
}

function readExpressionPrimitive(
  expression: ExpressionNode | undefined,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>,
  bindings: TemplateBindings
): { ok: true; value: StaticPrimitive } | { ok: false } {
  const node = expression
    ? getExpressionNode(expression, expressionPlugins)
    : undefined;
  return readStaticPrimitive(node, (identifier) => {
    if (shadowed.has(identifier.name)) return { ok: false };
    const value = bindings.staticValues.get(identifier.name);
    return bindings.staticValues.has(identifier.name)
      ? { ok: true, value: value! }
      : { ok: false };
  });
}

function getExpressionNode(
  expression: ExpressionNode,
  expressionPlugins: ParserPlugin[]
): babel.Node | undefined {
  if (expression.type !== NodeTypes.SIMPLE_EXPRESSION) return undefined;
  if (expression.ast && typeof expression.ast === 'object') {
    return expression.ast as babel.Node;
  }
  try {
    return parseExpression(expression.content, {
      plugins: expressionPlugins,
    });
  } catch {
    return undefined;
  }
}

function wrapForTraversal(node: babel.Node): babel.File | undefined {
  if (node.type === 'File') return node;
  if (node.type === 'Program') return babel.file(node);
  if (babel.isExpression(node)) {
    return babel.file(
      babel.program([babel.expressionStatement(node as babel.Expression)])
    );
  }
  if (babel.isStatement(node)) {
    return babel.file(babel.program([node]));
  }
  return undefined;
}

function collectElementScopeBindings(
  element: ElementNode,
  expressionPlugins: ParserPlugin[]
): Set<string> {
  const result = new Set<string>();
  for (const property of element.props) {
    if (property.type !== NodeTypes.DIRECTIVE) continue;
    if (property.name === 'for') {
      const parseResult = (
        property as DirectiveNode & { forParseResult?: ForParseResult }
      ).forParseResult;
      for (const alias of [
        parseResult?.value,
        parseResult?.key,
        parseResult?.index,
      ]) {
        for (const name of collectExpressionBindings(
          alias,
          expressionPlugins
        )) {
          result.add(name);
        }
      }
    } else if (property.name === 'slot') {
      for (const name of collectExpressionBindings(
        property.exp,
        expressionPlugins
      )) {
        result.add(name);
      }
    }
  }
  return result;
}

function collectExpressionBindings(
  expression: ExpressionNode | undefined,
  expressionPlugins: ParserPlugin[]
): Set<string> {
  const result = new Set<string>();
  if (
    !expression ||
    expression.type !== NodeTypes.SIMPLE_EXPRESSION ||
    !expression.content
  ) {
    return result;
  }
  try {
    const arrow = parseExpression(`(${expression.content}) => 0`, {
      plugins: expressionPlugins,
    });
    if (arrow.type === 'ArrowFunctionExpression') {
      for (const parameter of arrow.params)
        collectPatternNames(parameter, result);
    }
  } catch {
    // The Vue compiler reports malformed v-for/v-slot bindings separately.
  }
  return result;
}

function collectPatternNames(
  pattern: babel.Node | null,
  result: Set<string>
): void {
  if (!pattern) return;
  if (pattern.type === 'Identifier') {
    result.add(pattern.name);
  } else if (pattern.type === 'RestElement') {
    collectPatternNames(pattern.argument, result);
  } else if (pattern.type === 'AssignmentPattern') {
    collectPatternNames(pattern.left, result);
  } else if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) collectPatternNames(element, result);
    }
  } else if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        collectPatternNames(property.argument, result);
      } else {
        collectPatternNames(property.value, result);
      }
    }
  } else if (pattern.type === 'TSParameterProperty') {
    collectPatternNames(pattern.parameter, result);
  }
}

function resolveGTComponent(
  element: ElementNode,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>
): { localName: string; originalName: GTComponentName } | undefined {
  if (element.tagType !== ElementTypes.COMPONENT) return undefined;
  const selector = readDynamicComponentSelector(element, expressionPlugins);
  if (
    selector?.kind === 'expression' &&
    shadowed.has(selector.expressionName)
  ) {
    return undefined;
  }
  const sourceName = selector?.name ?? element.tag;
  const camelized = sourceName.replace(/-(\w)/g, (_match, letter: string) =>
    letter.toUpperCase()
  );
  const pascalized = camelized
    ? camelized[0].toUpperCase() + camelized.slice(1)
    : camelized;
  for (const localName of new Set([sourceName, camelized, pascalized])) {
    if (
      selector?.kind === 'string' &&
      !bindings.registeredComponents.has(localName)
    ) {
      continue;
    }
    const originalName = bindings.components.get(localName);
    if (originalName) {
      return { localName, originalName };
    }
  }
  return undefined;
}

/** Resolves a statically knowable Vue dynamic-component selector. */
function readDynamicComponentSelector(
  element: ElementNode,
  expressionPlugins: ParserPlugin[]
):
  | { kind: 'expression'; expressionName: string; name: string }
  | { kind: 'string'; name: string }
  | undefined {
  if (element.tag.toLowerCase() !== 'component') return undefined;
  const property = element.props.find((candidate) =>
    isDynamicComponentSelector(element, candidate)
  );
  if (!property) return undefined;
  if (property.type === NodeTypes.ATTRIBUTE) {
    return property.value
      ? { kind: 'string', name: property.value.content }
      : undefined;
  }
  const node = property.exp
    ? getExpressionNode(property.exp, expressionPlugins)
    : undefined;
  const unwrapped = unwrapExpression(node);
  if (unwrapped?.type === 'Identifier') {
    return {
      kind: 'expression',
      expressionName: unwrapped.name,
      name: unwrapped.name,
    };
  }
  if (unwrapped?.type === 'StringLiteral') {
    return { kind: 'string', name: unwrapped.value };
  }
  if (
    (unwrapped?.type === 'MemberExpression' ||
      unwrapped?.type === 'OptionalMemberExpression') &&
    unwrapped.object.type === 'Identifier' &&
    ((!unwrapped.computed && unwrapped.property.type === 'Identifier') ||
      (unwrapped.computed && unwrapped.property.type === 'StringLiteral'))
  ) {
    const property =
      unwrapped.property.type === 'Identifier'
        ? unwrapped.property.name
        : unwrapped.property.value;
    return {
      kind: 'expression',
      expressionName: unwrapped.object.name,
      name: `${unwrapped.object.name}.${property}`,
    };
  }
  return undefined;
}

/** Identifies the selector prop that Vue consumes for `<component>`. */
function isDynamicComponentSelector(
  element: ElementNode,
  property: ElementNode['props'][number]
): boolean {
  if (element.tag.toLowerCase() !== 'component') return false;
  if (property.type === NodeTypes.ATTRIBUTE) return property.name === 'is';
  return property.name === 'bind' && readDirectiveKey(property) === 'is';
}

function readDirectiveKey(directive: DirectiveNode): string | undefined {
  return directive.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
    directive.arg.isStatic
    ? directive.arg.content
    : undefined;
}

function toDisplayString(value: StaticPrimitive): string {
  return value == null ? '' : String(value);
}

function appendSerializedChild(result: JsxChild[], value: JsxChild): void {
  const previous = result[result.length - 1];
  if (typeof previous === 'string' && typeof value === 'string') {
    result[result.length - 1] = previous + value;
  } else {
    result.push(value);
  }
}

function collapseChildren(children: JsxChild[]): JsxChildren {
  return children.length === 1 ? children[0] : children;
}

function unionSets(first: Set<string>, second: Set<string>): Set<string> {
  return second.size === 0 ? first : new Set([...first, ...second]);
}
