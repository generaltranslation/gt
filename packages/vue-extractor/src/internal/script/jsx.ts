import type { NodePath, Scope } from '@babel/traverse';
import * as babel from '@babel/types';
import {
  HTML_CONTENT_PROPS,
  type GTProp,
  type JsxChild,
  type JsxChildren,
} from '@generaltranslation/format/types';
import { isHTMLTag, isSVGTag } from '@vue/shared';
import { isAcceptedPluralForm } from 'generaltranslation/internal';
import type { GTComponentName, VueExtractionContext } from '../types.js';
import {
  addVueError,
  babelLocation,
  createInlineMetadata,
  type StaticPrimitive,
  type StaticPrimitiveResult,
  unwrapExpression,
} from '../utils.js';
import type { KnownValue } from './model.js';

type Counter = { value: number };

/** Prevents source strings on opposite sides of a JSX comment from merging. */
const jsxTextBoundary = Symbol('gt-vue-jsx-text-boundary');

type SerializedJSXChild = JsxChild | typeof jsxTextBoundary;

type JSXSlotFunction = {
  node:
    | babel.ArrowFunctionExpression
    | babel.FunctionExpression
    | babel.ObjectMethod;
  scope: Scope;
};

type JSXSlotLayout = {
  defaultChildren: babel.JSXElement['children'];
  defaultSlot?: JSXSlotFunction;
  namedSlots: Map<string, JSXSlotFunction>;
};

type OrdinaryElementShape = {
  /** Whether Vue represents authored JSX children as a default slot. */
  component: boolean;
  /** Proven runtime string tag, retained only for catalog readability. */
  tag?: string;
};

/** Narrow script-analysis capabilities required by rich JSX extraction. */
export type VueJSXAnalysis = {
  /** Per-file pragma that replaces Vue's VNode factory, when present. */
  customPragma?: babel.Comment;
  /** Resolves an expression to a proven gt-vue or Vue runtime identity. */
  resolveKnownValue: (
    expression: babel.Expression,
    scope: Scope
  ) => KnownValue | undefined;
  /** Evaluates the side-effect-free primitive subset at this source position. */
  readStaticPrimitive: (
    expression: babel.Node,
    scope: Scope
  ) => StaticPrimitiveResult;
  /** Resolves a safely retained object literal without executing user code. */
  resolveStaticObject: (
    expression: babel.Node,
    scope: Scope
  ) => { node: babel.ObjectExpression; scope: Scope } | undefined;
  /** Returns Babel's lexical scope for a nested function or expression. */
  scopeForNode: (node: babel.Node, fallback: Scope) => Scope;
};

const RESERVED_T_PROPS = new Set(['key', 'ref']);
const FORMAT_COMPONENTS = new Set<GTComponentName>([
  'Currency',
  'DateTime',
  'Num',
]);
const NON_BRANCH_PROP_NAMES = new Set([
  'branch',
  'class',
  'key',
  'locales',
  'n',
  'ref',
  'ref-for',
  'ref-key',
  'ref_for',
  'ref_key',
  'style',
  'v-slots',
  'vSlots',
]);

/**
 * Extracts one statically identified gt-vue `T` JSX element.
 *
 * This serializer follows the VNodes emitted by `@vue/babel-plugin-jsx`:
 * fragments are transparent, JSX text uses the plugin's normalization, and
 * static custom-component default slots participate in the same rich source
 * tree as React component children. Runtime values remain explicit variable
 * boundaries and named component slots remain outside the outer translation.
 */
export function extractVueJSXTranslation(
  path: NodePath<babel.JSXElement>,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): void {
  if (analysis.customPragma) {
    addVueError(
      context,
      babelLocation(analysis.customPragma.loc),
      'Found a custom @jsx pragma in a gt-vue JSX translation file',
      'Use the default Vue JSX VNode factory for files containing gt-vue <T>'
    );
    return;
  }
  const errorCount = context.errors.length;
  const translationContext = readTranslationContext(
    path.node.openingElement,
    path.scope,
    context,
    analysis
  );
  const source = collapseChildren(
    serializeChildren(
      path.node.children,
      { value: 0 },
      path.scope,
      context,
      analysis
    )
  );
  if (context.errors.length !== errorCount) return;

  context.results.push({
    dataFormat: 'JSX',
    source,
    metadata: createInlineMetadata(
      context,
      babelLocation(path.node.loc),
      translationContext
    ),
  });
}

/** Returns whether the visitor is already covered by an outer serialized T. */
export function isNestedInVueJSXTranslation(
  path: NodePath<babel.JSXElement>,
  analysis: VueJSXAnalysis
): boolean {
  let current: NodePath | null = path.parentPath;
  while (current) {
    if (current.isJSXElement()) {
      const element = current.node;
      const identity = resolveElementIdentity(
        element.openingElement.name,
        current.scope,
        analysis
      );
      const containingAttribute = findContainingJSXAttribute(path, current);
      if (containingAttribute) {
        if (!isSlotsAttribute(containingAttribute.node)) {
          // JSX inside an event or ordinary prop is not a child VNode of the
          // surrounding translation. Extract it independently if it is T.
          return false;
        }
        if (
          identity?.type === 'component' &&
          (identity.name === 'Branch' || identity.name === 'Plural')
        ) {
          // Every stable Branch and Plural slot belongs to the outer source.
          current = current.parentPath;
          continue;
        }
        if (
          identity?.type === 'component' &&
          (identity.name === 'Var' || FORMAT_COMPONENTS.has(identity.name))
        ) {
          return false;
        }
        const slotName = readContainingJSXSlotName(
          path,
          containingAttribute,
          analysis
        );
        // Only a component's default slot belongs to the surrounding rich
        // source. Named slots have independent lifetimes and may contain an
        // independently extracted T. An unresolved key is kept nested so the
        // outer extraction owns the fail-closed diagnostic without emitting a
        // second, misleading catalog entry.
        if (slotName !== 'default') return slotName === undefined;
      }
      if (
        !containingAttribute &&
        identity?.type !== 'component' &&
        (identity?.type !== 'vue-builtin' ||
          usesFragmentComponentSlots(element.openingElement.name, identity))
      ) {
        const shape = identity
          ? { component: true }
          : resolveOrdinaryElementShape(
              element.openingElement.name,
              current.scope,
              analysis,
              new Set()
            );
        if (shape?.component) {
          const objectSlot = readContainingJSXObjectSlotName(
            path,
            current,
            analysis
          );
          if (objectSlot.present && objectSlot.name !== 'default') {
            return objectSlot.name === undefined;
          }
        }
      }
      if (identity?.type === 'component') {
        if (identity.name === 'T') return true;
        if (identity.name === 'Var' || FORMAT_COMPONENTS.has(identity.name)) {
          return false;
        }
        // Branch and Plural own stable slots, so an outer T reaches them.
      } else if (
        identity?.type === 'vue-builtin' &&
        (identity.name !== 'Fragment' ||
          isTransparentFragment(element.openingElement.name, identity))
      ) {
        // Vue Fragment aliases and normalized Suspense default content are
        // transparent to the runtime source tree.
      }
    }
    current = current.parentPath;
  }
  return false;
}

/** Finds an attribute boundary between a nested JSX node and one ancestor. */
function findContainingJSXAttribute(
  path: NodePath,
  ancestor: NodePath<babel.JSXElement>
): NodePath<babel.JSXAttribute> | undefined {
  let current: NodePath | null = path.parentPath;
  while (current && current !== ancestor) {
    if (
      current.isJSXAttribute() &&
      current.parentPath?.isJSXOpeningElement() &&
      current.parentPath.parentPath === ancestor
    ) {
      return current;
    }
    current = current.parentPath;
  }
  return undefined;
}

function isSlotsAttribute(attribute: babel.JSXAttribute): boolean {
  const name = readAttributeName(attribute.name);
  return name === 'v-slots' || name === 'vSlots';
}

/** Returns the direct static slot key containing one nested JSX element. */
function readContainingJSXSlotName(
  path: NodePath,
  attribute: NodePath<babel.JSXAttribute>,
  analysis: VueJSXAnalysis
): string | undefined {
  const expression =
    attribute.node.value?.type === 'JSXExpressionContainer' &&
    attribute.node.value.expression.type !== 'JSXEmptyExpression'
      ? unwrapExpression(attribute.node.value.expression)
      : undefined;
  if (expression?.type !== 'ObjectExpression') return undefined;

  let current: NodePath | null = path.parentPath;
  while (current && current.node !== expression) {
    if (
      current.parentPath?.node === expression &&
      (current.isObjectMethod() || current.isObjectProperty())
    ) {
      return readStaticObjectKey(current.node, attribute.scope, analysis);
    }
    current = current.parentPath;
  }
  return undefined;
}

/** Classifies a nested element inside Vue's object-child slot spelling. */
function readContainingJSXObjectSlotName(
  path: NodePath,
  element: NodePath<babel.JSXElement>,
  analysis: VueJSXAnalysis
): { name?: string; present: boolean } {
  const meaningfulChildren = element.node.children.filter(isMeaningfulJSXChild);
  const child = meaningfulChildren[0];
  if (
    meaningfulChildren.length !== 1 ||
    child?.type !== 'JSXExpressionContainer' ||
    child.expression.type === 'JSXEmptyExpression'
  ) {
    return { present: false };
  }
  const object = unwrapExpression(child.expression);
  if (object?.type !== 'ObjectExpression') return { present: false };

  let current: NodePath | null = path.parentPath;
  while (current && current.node !== object) {
    if (
      current.parentPath?.node === object &&
      (current.isObjectMethod() || current.isObjectProperty())
    ) {
      return {
        name: readStaticObjectKey(current.node, element.scope, analysis),
        present: true,
      };
    }
    current = current.parentPath;
  }
  return { present: false };
}

/** Resolves a JSX tag to the identity tracked by the script analyzer. */
export function resolveVueJSXElementIdentity(
  name: babel.JSXElement['openingElement']['name'],
  scope: Scope,
  analysis: VueJSXAnalysis
): KnownValue | undefined {
  return resolveElementIdentity(name, scope, analysis);
}

/** Enforces the one supported public shape for a gt-vue variable component. */
export function validateVueJSXVariableComponent(
  element: babel.JSXElement,
  component: 'Currency' | 'DateTime' | 'Num' | 'Var',
  context: VueExtractionContext
): void {
  validateVariableElement(element, component, context);
}

function readTranslationContext(
  element: babel.JSXOpeningElement,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): string | undefined {
  let translationContext: string | undefined;
  let hasContext = false;

  for (const attribute of element.attributes) {
    if (attribute.type === 'JSXSpreadAttribute') {
      addVueError(
        context,
        babelLocation(attribute.loc),
        'Found a spread prop on a gt-vue <T> component in JSX',
        'Pass context as one explicit static context or $context prop'
      );
      continue;
    }
    const name = readAttributeName(attribute.name);
    if (RESERVED_T_PROPS.has(name)) continue;
    if (name !== 'context' && name !== '$context') {
      addVueError(
        context,
        babelLocation(attribute.loc),
        `Found unsupported prop "${name}" on a gt-vue <T> component`,
        'gt-vue <T> currently supports only context'
      );
      continue;
    }
    if (hasContext) {
      addVueError(
        context,
        babelLocation(attribute.loc),
        'Found duplicate context props on a gt-vue <T> component',
        'Pass only one context prop'
      );
      continue;
    }
    hasContext = true;
    const contextExpression =
      attribute.value?.type === 'JSXExpressionContainer' &&
      attribute.value.expression.type !== 'JSXEmptyExpression'
        ? unwrapExpression(attribute.value.expression)
        : undefined;
    if (
      contextExpression?.type === 'ConditionalExpression' ||
      contextExpression?.type === 'LogicalExpression'
    ) {
      addVueError(
        context,
        babelLocation(attribute.loc),
        'Found conditional context on a gt-vue <T> component',
        'Use one invariant static context string for this translation'
      );
      continue;
    }
    const value = readJSXAttributePrimitive(attribute, scope, analysis);
    if (!value.ok || typeof value.value !== 'string') {
      addVueError(
        context,
        babelLocation(attribute.loc),
        'Found a dynamic context on a gt-vue <T> component',
        'Use a string literal or an immutable static string'
      );
      continue;
    }
    translationContext = value.value;
  }
  return translationContext;
}

function serializeChildren(
  children: Array<
    | babel.JSXText
    | babel.JSXExpressionContainer
    | babel.JSXSpreadChild
    | babel.JSXElement
    | babel.JSXFragment
  >,
  counter: Counter,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): SerializedJSXChild[] {
  const result: SerializedJSXChild[] = [];
  for (const child of children) {
    for (const serialized of serializeChild(
      child,
      counter,
      scope,
      context,
      analysis
    )) {
      appendSerializedChild(result, serialized);
    }
  }
  return result;
}

function serializeChild(
  child:
    | babel.JSXText
    | babel.JSXExpressionContainer
    | babel.JSXSpreadChild
    | babel.JSXElement
    | babel.JSXFragment,
  counter: Counter,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): SerializedJSXChild[] {
  if (child.type === 'JSXText') {
    const text = normalizeJSXText(child.value);
    return text ? [text] : [];
  }
  if (child.type === 'JSXElement') {
    return serializeElement(child, counter, scope, context, analysis);
  }
  if (child.type === 'JSXFragment') {
    return serializeChildren(child.children, counter, scope, context, analysis);
  }
  if (child.type === 'JSXSpreadChild') {
    addVueError(
      context,
      babelLocation(child.loc),
      'Found a spread child inside a gt-vue <T> component in JSX',
      'Use static JSX children and wrap one runtime value in a gt-vue variable component'
    );
    return [];
  }
  if (child.expression.type === 'JSXEmptyExpression') {
    return [jsxTextBoundary];
  }
  return serializeExpression(
    child.expression,
    counter,
    scope,
    context,
    analysis
  );
}

function serializeExpression(
  input: babel.Expression,
  counter: Counter,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): SerializedJSXChild[] {
  const expression = unwrapExpression(input);
  if (!expression) return [];
  if (expression.type === 'JSXElement') {
    return serializeElement(expression, counter, scope, context, analysis);
  }
  if (expression.type === 'JSXFragment') {
    return serializeChildren(
      expression.children,
      counter,
      scope,
      context,
      analysis
    );
  }
  if (expression.type === 'ArrayExpression') {
    const result: SerializedJSXChild[] = [];
    for (const item of expression.elements) {
      if (!item) continue;
      if (item.type === 'SpreadElement') {
        addVueError(
          context,
          babelLocation(item.loc),
          'Found a spread array child inside a gt-vue <T> component in JSX',
          'List each static child explicitly'
        );
        continue;
      }
      for (const serialized of serializeExpression(
        item,
        counter,
        scope,
        context,
        analysis
      )) {
        appendSerializedChild(result, serialized);
      }
    }
    return result;
  }
  if (
    expression.type === 'ConditionalExpression' ||
    expression.type === 'LogicalExpression'
  ) {
    addVueError(
      context,
      babelLocation(expression.loc),
      'Found conditional JSX content inside a gt-vue <T> component',
      'Move conditional content outside <T>, or use a static Branch or Plural component'
    );
    return [];
  }

  const value = analysis.readStaticPrimitive(expression, scope);
  if (!value.ok) {
    addVueError(
      context,
      babelLocation(expression.loc),
      'Found dynamic JSX content inside a gt-vue <T> component',
      'Wrap runtime values in <Var>, <Num>, <DateTime>, or <Currency>'
    );
    return [];
  }
  // Vue drops null and boolean JSX children. All other primitive VNode
  // children are stringified by gt-vue before the source is hashed.
  return value.value == null || typeof value.value === 'boolean'
    ? []
    : [String(value.value)];
}

function serializeElement(
  element: babel.JSXElement,
  counter: Counter,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): SerializedJSXChild[] {
  const name = element.openingElement.name;
  const identity = resolveElementIdentity(name, scope, analysis);
  if (isTransparentFragment(name, identity)) {
    return usesFragmentComponentSlots(name, identity)
      ? serializeOrdinaryComponentDefault(
          element,
          counter,
          scope,
          context,
          analysis
        )
      : serializeChildren(element.children, counter, scope, context, analysis);
  }

  counter.value += 1;
  const id = counter.value;
  const component = identity?.type === 'component' ? identity.name : undefined;

  validateElementAttributes(element.openingElement, scope, context, analysis);
  if (component === 'T') {
    addVueError(
      context,
      babelLocation(element.loc),
      'Found a nested gt-vue <T> component inside another <T>',
      'Split nested translations into sibling <T> components'
    );
    return [];
  }
  if (
    component === 'Var' ||
    component === 'Num' ||
    component === 'DateTime' ||
    component === 'Currency'
  ) {
    validateVariableElement(element, component, context);
    const variable =
      component === 'Num'
        ? { name: 'n', type: 'n' as const }
        : component === 'DateTime'
          ? { name: 'date', type: 'd' as const }
          : component === 'Currency'
            ? { name: 'cost', type: 'c' as const }
            : { name: 'value', type: 'v' as const };
    return [{ i: id, k: `_gt_${variable.name}_${id}`, v: variable.type }];
  }
  if (component === 'Branch' || component === 'Plural') {
    return [
      serializeBranchElement(
        element,
        id,
        component,
        counter,
        scope,
        context,
        analysis
      ),
    ];
  }
  if (identity?.type === 'vue-builtin' && identity.name === 'Suspense') {
    return [
      serializeSuspenseElement(element, id, counter, scope, context, analysis),
    ];
  }
  if (!identity && isUnboundNonNativeElement(name, scope)) {
    addVueError(
      context,
      babelLocation(element.loc),
      `Could not determine whether JSX tag <${readElementDisplayName(name) ?? 'unknown'}> is a component or custom element`,
      'Import or locally bind the component, or move the configured custom element outside <T>'
    );
    return [];
  }

  // Every remaining known identity is a runtime function or object. Vue
  // therefore creates a component VNode whose authored default slot is the
  // equivalent of React `children` and belongs to this rich source tree.
  const ordinaryShape = identity
    ? { component: true }
    : resolveOrdinaryElementShape(name, scope, analysis, new Set());
  if (!identity && !ordinaryShape) {
    addVueError(
      context,
      babelLocation(element.loc),
      `Could not statically resolve whether JSX tag <${readElementDisplayName(name) ?? 'unknown'}> renders an element or component`,
      'Use a native tag, imported component, defineComponent result, or an immutable tag expression that cannot switch between element and component shapes'
    );
    return [];
  }

  const data = readContentProps(
    element.openingElement,
    scope,
    context,
    analysis
  );
  const tag = ordinaryShape?.tag ?? readElementDisplayName(name);
  if (!tag) {
    addVueError(
      context,
      babelLocation(element.loc),
      'Found unsupported namespaced JSX syntax inside a gt-vue <T> component',
      'Use a native element or a statically imported component'
    );
    return [];
  }
  const children = ordinaryShape?.component
    ? serializeOrdinaryComponentDefault(
        element,
        counter,
        scope,
        context,
        analysis
      )
    : serializeChildren(element.children, counter, scope, context, analysis);
  return [
    {
      t: tag,
      i: id,
      ...(Object.keys(data).length > 0 && { d: data }),
      ...(children.length > 0 && { c: collapseChildren(children) }),
    },
  ];
}

/** Serializes the authored default slot of an ordinary component VNode. */
function serializeOrdinaryComponentDefault(
  element: babel.JSXElement,
  counter: Counter,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): SerializedJSXChild[] {
  const slotAttributes = element.openingElement.attributes.filter(
    (attribute): attribute is babel.JSXAttribute =>
      attribute.type === 'JSXAttribute' && isSlotsAttribute(attribute)
  );
  if (slotAttributes.length > 1) {
    addVueError(
      context,
      babelLocation(slotAttributes[1]!.loc),
      'Found more than one v-slots prop on a component inside a gt-vue JSX translation',
      'Pass one static slots object'
    );
  }

  const meaningfulChildren = element.children.filter(isMeaningfulJSXChild);
  const objectSlotChild =
    slotAttributes.length === 0 &&
    meaningfulChildren.length === 1 &&
    meaningfulChildren[0]?.type === 'JSXExpressionContainer' &&
    meaningfulChildren[0].expression.type !== 'JSXEmptyExpression'
      ? analysis.resolveStaticObject(meaningfulChildren[0].expression, scope)
      : undefined;
  const slotsObject = slotAttributes[0]
    ? readSlotsAttributeObject(
        slotAttributes[0],
        scope,
        context,
        analysis,
        'a component inside a gt-vue JSX translation'
      )
    : objectSlotChild;
  const defaultSlot = slotsObject
    ? readOrdinaryDefaultSlot(slotsObject, context, analysis)
    : { present: false };

  if (defaultSlot.present) {
    return defaultSlot.slot
      ? serializeSlotFunction(defaultSlot.slot, counter, context, analysis)
      : [];
  }
  const directSlot = readDirectOrdinaryDefaultSlot(
    element,
    scope,
    context,
    analysis
  );
  if (directSlot.present) {
    return directSlot.slot
      ? serializeSlotFunction(directSlot.slot, counter, context, analysis)
      : [];
  }
  if (objectSlotChild) return [];
  return serializeChildren(element.children, counter, scope, context, analysis);
}

/** Reads the one-function child Vue JSX compiles as a direct default slot. */
function readDirectOrdinaryDefaultSlot(
  element: babel.JSXElement,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): { present: boolean; slot?: JSXSlotFunction } {
  const children = element.children.filter(isMeaningfulJSXChild);
  if (
    children.length !== 1 ||
    children[0]?.type !== 'JSXExpressionContainer' ||
    children[0].expression.type === 'JSXEmptyExpression'
  ) {
    return { present: false };
  }
  const value = unwrapExpression(children[0].expression);
  if (
    !value ||
    (value.type !== 'ArrowFunctionExpression' &&
      value.type !== 'FunctionExpression')
  ) {
    return { present: false };
  }
  if (value.params.length > 0 || value.async || value.generator) {
    addVueError(
      context,
      babelLocation(value.loc),
      'Found a dynamic or scoped direct default slot on a component inside a gt-vue JSX translation',
      'Use a synchronous zero-argument function with static returned content'
    );
    return { present: true };
  }
  return {
    present: true,
    slot: {
      node: value,
      scope: analysis.scopeForNode(value, scope),
    },
  };
}

/** Reads only the default entry; named slots remain runtime-owned and opaque. */
function readOrdinaryDefaultSlot(
  object: { node: babel.ObjectExpression; scope: Scope },
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): { present: boolean; slot?: JSXSlotFunction } {
  let present = false;
  let slot: JSXSlotFunction | undefined;

  for (const property of object.node.properties) {
    if (property.type === 'SpreadElement') {
      addVueError(
        context,
        babelLocation(property.loc),
        'Found a spread in a component slots object inside a gt-vue JSX translation',
        'List the static default slot explicitly so a spread cannot add or replace it'
      );
      continue;
    }
    const name = readStaticObjectKey(property, object.scope, analysis);
    if (name === undefined) {
      addVueError(
        context,
        babelLocation(property.loc),
        'Found a dynamic slot name on a component inside a gt-vue JSX translation',
        'Use a static named slot or an explicit default key'
      );
      continue;
    }
    if (name !== 'default') continue;
    if (present) {
      addVueError(
        context,
        babelLocation(property.loc),
        'Found duplicate default slots on a component inside a gt-vue JSX translation',
        'Define the default slot once'
      );
      continue;
    }
    present = true;
    if (property.computed) {
      addVueError(
        context,
        babelLocation(property.loc),
        'Found a computed default slot on a component inside a gt-vue JSX translation',
        'Use the literal default key'
      );
      continue;
    }
    const value =
      property.type === 'ObjectMethod' && property.kind === 'method'
        ? property
        : property.type === 'ObjectProperty'
          ? unwrapExpression(property.value)
          : undefined;
    if (
      !value ||
      (value.type !== 'ArrowFunctionExpression' &&
        value.type !== 'FunctionExpression' &&
        value.type !== 'ObjectMethod') ||
      value.params.length > 0 ||
      value.async ||
      value.generator
    ) {
      addVueError(
        context,
        babelLocation(property.loc),
        'Found a dynamic or scoped default slot on a component inside a gt-vue JSX translation',
        'Use a synchronous zero-argument function with static returned content'
      );
      continue;
    }
    slot = {
      node: value,
      scope: analysis.scopeForNode(value, object.scope),
    };
  }

  return { present, ...(slot && { slot }) };
}

/**
 * Serializes Vue Suspense's normalized default content without evaluating its
 * fallback. Vue requires that default slot to resolve to one VNode root; an
 * ambiguous or multi-root shape is rejected before it can hash differently.
 */
function serializeSuspenseElement(
  element: babel.JSXElement,
  id: number,
  counter: Counter,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): JsxChild {
  const slots = readJSXSlotLayout(
    element,
    scope,
    context,
    analysis,
    'suspense'
  );
  const directSlot = readDirectSuspenseSlot(element, scope, context, analysis);
  if (directSlot.present) {
    slots.defaultChildren = [];
    slots.defaultSlot = directSlot.slot;
  }

  for (const name of slots.namedSlots.keys()) {
    if (name === 'fallback' || name.startsWith('_')) continue;
    addVueError(
      context,
      babelLocation(element.loc),
      `Found unsupported named slot "${name}" on Vue <Suspense> inside a gt-vue <T> component`,
      'Use only the default and fallback Suspense slots'
    );
  }

  if (slots.defaultSlot) {
    validateSuspenseSlotRoot(slots.defaultSlot, element, context);
  } else {
    validateSuspenseImplicitRoot(slots.defaultChildren, element, context);
  }

  const children = slots.defaultSlot
    ? serializeSlotFunction(slots.defaultSlot, counter, context, analysis)
    : serializeChildren(
        slots.defaultChildren,
        counter,
        scope,
        context,
        analysis
      );
  const data = readContentProps(
    element.openingElement,
    scope,
    context,
    analysis
  );
  return {
    t: 'Suspense',
    i: id,
    ...(Object.keys(data).length > 0 && { d: data }),
    ...(children.length > 0 && { c: collapseChildren(children) }),
  };
}

/** Reads the unambiguous one-function JSX spelling for a default slot. */
function readDirectSuspenseSlot(
  element: babel.JSXElement,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): { present: boolean; slot?: JSXSlotFunction } {
  if (
    hasExplicitAttribute(element.openingElement, 'v-slots') ||
    hasExplicitAttribute(element.openingElement, 'vSlots')
  ) {
    return { present: false };
  }
  const children = element.children.filter(isMeaningfulJSXChild);
  if (
    children.length !== 1 ||
    children[0]?.type !== 'JSXExpressionContainer' ||
    children[0].expression.type === 'JSXEmptyExpression'
  ) {
    return { present: false };
  }
  const value = unwrapExpression(children[0].expression);
  if (
    !value ||
    (value.type !== 'ArrowFunctionExpression' &&
      value.type !== 'FunctionExpression')
  ) {
    return { present: false };
  }
  if (value.params.length > 0 || value.async || value.generator) {
    addVueError(
      context,
      babelLocation(value.loc),
      'Found a dynamic or scoped default slot on Vue <Suspense> inside a gt-vue <T> component',
      'Use a synchronous zero-argument function with static returned content'
    );
    return { present: true };
  }
  return {
    present: true,
    slot: {
      node: value,
      scope: analysis.scopeForNode(value, scope),
    },
  };
}

/** Enforces the single-root contract for children wrapped by the JSX plugin. */
function validateSuspenseImplicitRoot(
  children: babel.JSXElement['children'],
  element: babel.JSXElement,
  context: VueExtractionContext
): void {
  const roots = children.filter(isMeaningfulJSXChild);
  if (roots.length > 1) {
    addSuspenseRootError(element, context);
    return;
  }
  const root = roots[0];
  if (
    root?.type === 'JSXExpressionContainer' &&
    root.expression.type !== 'JSXEmptyExpression'
  ) {
    const expression = unwrapExpression(root.expression);
    if (
      expression?.type !== 'JSXElement' &&
      expression?.type !== 'JSXFragment'
    ) {
      addVueError(
        context,
        babelLocation(root.loc),
        'Could not statically prove the default root of Vue <Suspense> inside a gt-vue <T> component',
        'Use one JSX element, Fragment, or a static zero-argument default slot'
      );
    }
  }
}

/** Enforces the single-root contract for an explicit static slot function. */
function validateSuspenseSlotRoot(
  slot: JSXSlotFunction,
  element: babel.JSXElement,
  context: VueExtractionContext
): void {
  const returned = readStaticSlotReturn(slot);
  const expression = returned && unwrapExpression(returned);
  if (expression?.type !== 'ArrayExpression') return;
  const roots = expression.elements.filter(Boolean);
  if (
    roots.length > 1 ||
    roots.some(
      (root) =>
        root?.type === 'SpreadElement' ||
        (root?.type !== 'JSXElement' && root?.type !== 'JSXFragment')
    )
  ) {
    addSuspenseRootError(element, context);
  }
}

/** Reports the stable diagnostic shared by all invalid Suspense root shapes. */
function addSuspenseRootError(
  element: babel.JSXElement,
  context: VueExtractionContext
): void {
  addVueError(
    context,
    babelLocation(element.loc),
    'Found more than one or an invalid default root inside Vue <Suspense> within a gt-vue <T> component',
    'Wrap the Suspense default content in one element or Fragment, or move <T> inside <Suspense>'
  );
}

/** Serializes GT-owned Branch and Plural slots with independent ID scopes. */
function serializeBranchElement(
  element: babel.JSXElement,
  id: number,
  component: 'Branch' | 'Plural',
  counter: Counter,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): JsxChild {
  const slots = readJSXSlotLayout(element, scope, context, analysis);
  if (
    component === 'Plural' &&
    !hasExplicitAttribute(element.openingElement, 'n')
  ) {
    addVueError(
      context,
      babelLocation(element.openingElement.loc),
      'Found a gt-vue <Plural> component without an n prop',
      'Pass the numeric selector through <Plural n={count} />'
    );
  }

  const children = slots.defaultSlot
    ? serializeSlotFunction(slots.defaultSlot, counter, context, analysis)
    : serializeChildren(
        slots.defaultChildren,
        counter,
        scope,
        context,
        analysis
      );
  const branches: Record<string, JsxChildren> = {};
  for (const [name, slot] of slots.namedSlots) {
    if (name.startsWith('_')) continue;
    if (component === 'Plural' && !isAcceptedPluralForm(name)) continue;
    branches[name] = collapseChildren(
      serializeSlotFunction(slot, { value: id }, context, analysis)
    );
  }
  readBranchAttributeSources(
    element.openingElement,
    component,
    branches,
    scope,
    context,
    analysis
  );

  const data = readContentProps(
    element.openingElement,
    scope,
    context,
    analysis
  );
  if (Object.keys(branches).length > 0) {
    data.b = branches;
    data.t = component === 'Plural' ? 'p' : 'b';
  }
  return {
    t: component,
    i: id,
    ...(Object.keys(data).length > 0 && { d: data }),
    ...(children.length > 0 && { c: collapseChildren(children) }),
  };
}

/** Reconstructs the slots object emitted by the Vue JSX transform. */
function readJSXSlotLayout(
  element: babel.JSXElement,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis,
  owner: 'branch' | 'suspense' = 'branch'
): JSXSlotLayout {
  const ownerLabel =
    owner === 'suspense' ? 'Vue <Suspense>' : 'a gt-vue JSX branch component';
  const vSlots = element.openingElement.attributes.filter(
    (attribute): attribute is babel.JSXAttribute =>
      attribute.type === 'JSXAttribute' && isSlotsAttribute(attribute)
  );
  if (vSlots.length > 1) {
    addVueError(
      context,
      babelLocation(vSlots[1]!.loc),
      `Found more than one v-slots prop on ${ownerLabel}`,
      'Pass one static slots object'
    );
  }

  const meaningfulChildren = element.children.filter(isMeaningfulJSXChild);
  const objectSlotChild =
    vSlots.length === 0 &&
    meaningfulChildren.length === 1 &&
    meaningfulChildren[0]?.type === 'JSXExpressionContainer' &&
    meaningfulChildren[0].expression.type !== 'JSXEmptyExpression'
      ? analysis.resolveStaticObject(meaningfulChildren[0].expression, scope)
      : undefined;
  if (objectSlotChild) {
    addVueError(
      context,
      babelLocation(meaningfulChildren[0]?.loc),
      'Found Vue object-slot child syntax in a gt-vue JSX translation',
      'Pass the static slots object through v-slots so extraction is independent of the JSX enableObjectSlots compiler option'
    );
  }
  const vSlotsObject = vSlots[0]
    ? readSlotsAttributeObject(vSlots[0], scope, context, analysis, ownerLabel)
    : undefined;
  const slotsObject = vSlotsObject;
  const namedSlots = new Map<string, JSXSlotFunction>();
  let defaultSlot: JSXSlotFunction | undefined;
  if (slotsObject) {
    for (const [name, slot] of readStaticSlotObject(
      slotsObject,
      context,
      analysis
    )) {
      if (name === 'default') defaultSlot = slot;
      else namedSlots.set(name, slot);
    }
  }

  return {
    defaultChildren: objectSlotChild ? [] : element.children,
    ...(defaultSlot && { defaultSlot }),
    namedSlots,
  };
}

function readSlotsAttributeObject(
  attribute: babel.JSXAttribute,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis,
  ownerLabel: string
): { node: babel.ObjectExpression; scope: Scope } | undefined {
  const expression =
    attribute.value?.type === 'JSXExpressionContainer' &&
    attribute.value.expression.type !== 'JSXEmptyExpression'
      ? attribute.value.expression
      : undefined;
  const object = expression
    ? analysis.resolveStaticObject(expression, scope)
    : undefined;
  if (!object) {
    addVueError(
      context,
      babelLocation(attribute.loc),
      `Found dynamic v-slots on ${ownerLabel}`,
      'Use a retained object literal with statically named zero-argument slot functions'
    );
  }
  return object;
}

/** Reads statically named zero-argument functions from one JSX slots object. */
function readStaticSlotObject(
  object: { node: babel.ObjectExpression; scope: Scope },
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): Map<string, JSXSlotFunction> {
  const slots = new Map<string, JSXSlotFunction>();
  for (const property of object.node.properties) {
    if (property.type === 'SpreadElement') {
      addVueError(
        context,
        babelLocation(property.loc),
        'Found a spread in a gt-vue JSX slots object',
        'List every static slot explicitly'
      );
      continue;
    }
    const name = readStaticObjectKey(property, object.scope, analysis);
    if (name === undefined) {
      addVueError(
        context,
        babelLocation(property.loc),
        'Found a dynamic slot name in a gt-vue JSX slots object',
        'Use a static string slot name'
      );
      continue;
    }
    if (slots.has(name)) {
      addVueError(
        context,
        babelLocation(property.loc),
        `Found duplicate JSX slot "${name}" in a gt-vue translation`,
        'Define every slot once'
      );
      continue;
    }
    const value =
      property.type === 'ObjectMethod'
        ? property
        : unwrapExpression(property.value);
    if (
      !value ||
      (value.type !== 'ArrowFunctionExpression' &&
        value.type !== 'FunctionExpression' &&
        value.type !== 'ObjectMethod') ||
      value.params.length > 0 ||
      value.async ||
      value.generator
    ) {
      addVueError(
        context,
        babelLocation(property.loc),
        `Found a dynamic or scoped JSX slot "${name}" in a gt-vue translation`,
        'Use a synchronous zero-argument function with static returned content'
      );
      continue;
    }
    slots.set(name, {
      node: value,
      scope: analysis.scopeForNode(value, object.scope),
    });
  }
  return slots;
}

function serializeSlotFunction(
  slot: JSXSlotFunction,
  counter: Counter,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): SerializedJSXChild[] {
  const returned = readStaticSlotReturn(slot);
  if (!returned) {
    addVueError(
      context,
      babelLocation(slot.node.loc),
      'Found a JSX slot with a dynamic function body in a gt-vue translation',
      'Return static slot content directly from the zero-argument function'
    );
    return [];
  }
  return serializeExpression(returned, counter, slot.scope, context, analysis);
}

/** Returns the expression from a slot body that contains only one return. */
function readStaticSlotReturn(
  slot: JSXSlotFunction
): babel.Expression | undefined {
  const body = slot.node.body;
  if (body.type !== 'BlockStatement') return body;
  const statements = body.body.filter(
    (statement) => statement.type !== 'EmptyStatement'
  );
  const returned =
    statements.length === 1 && statements[0]?.type === 'ReturnStatement'
      ? statements[0].argument
      : undefined;
  return returned ?? undefined;
}

function readStaticObjectKey(
  property: babel.ObjectMethod | babel.ObjectProperty,
  scope: Scope,
  analysis: VueJSXAnalysis
): string | undefined {
  if (!property.computed) {
    if (property.key.type === 'Identifier') return property.key.name;
    if (
      property.key.type === 'StringLiteral' ||
      property.key.type === 'NumericLiteral'
    ) {
      return String(property.key.value);
    }
    return undefined;
  }
  const key = analysis.readStaticPrimitive(property.key, scope);
  return key.ok &&
    (typeof key.value === 'string' || typeof key.value === 'number')
    ? String(key.value)
    : undefined;
}

function readBranchAttributeSources(
  element: babel.JSXOpeningElement,
  component: 'Branch' | 'Plural',
  branches: Record<string, JsxChildren>,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): void {
  const seenBranchProps = new Set<string>();
  for (const attribute of element.attributes) {
    if (attribute.type !== 'JSXAttribute') continue;
    const name = readAttributeName(attribute.name);
    if (
      !isBranchPropName(name) ||
      (component === 'Plural' && !isAcceptedPluralForm(name))
    ) {
      continue;
    }
    if (seenBranchProps.has(name)) {
      addVueError(
        context,
        babelLocation(attribute.loc),
        `Found duplicate branch prop "${name}" on a gt-vue <${component}> component`,
        'Pass each branch prop once so Vue JSX compiler options cannot change which value is hashed'
      );
      continue;
    }
    seenBranchProps.add(name);
    if (Object.prototype.hasOwnProperty.call(branches, name)) continue;
    const value = readJSXAttributePrimitive(attribute, scope, analysis);
    if (!value.ok) {
      if (isStaticallyNonBranchAttribute(attribute, scope)) continue;
      addVueError(
        context,
        babelLocation(attribute.loc),
        `Found dynamic branch prop "${name}" on a gt-vue <${component}> component`,
        'Use a static primitive branch prop or a static named slot'
      );
      continue;
    }
    branches[name] = serializeBranchAttributePrimitive(value.value);
  }
}

/**
 * Serializes one direct branch prop without applying Vue child normalization.
 *
 * Vue renders boolean and null VNode children empty, but React and gt-vue
 * preserve those direct prop values in the persisted branch wire format. The
 * shared `JsxChildren` type predates those values, so the cast stays confined
 * to this exact catalog boundary. Other primitives retain the established
 * string representation.
 */
function serializeBranchAttributePrimitive(
  value: StaticPrimitive
): JsxChildren {
  if (value === null || typeof value === 'boolean') {
    return value as unknown as JsxChildren;
  }
  return String(value);
}

function isBranchPropName(name: string): boolean {
  return !(
    NON_BRANCH_PROP_NAMES.has(name) ||
    name.startsWith('aria-') ||
    name.startsWith('data-') ||
    /^on[^a-z]/.test(name)
  );
}

function isStaticallyNonBranchAttribute(
  attribute: babel.JSXAttribute,
  scope: Scope
): boolean {
  const expression =
    attribute.value?.type === 'JSXExpressionContainer' &&
    attribute.value.expression.type !== 'JSXEmptyExpression'
      ? unwrapExpression(attribute.value.expression)
      : undefined;
  if (!expression) return false;
  if (expression.type === 'Identifier' && expression.name === 'undefined') {
    return !scope.hasBinding('undefined');
  }
  return (
    expression.type === 'ArrayExpression' ||
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'ClassExpression' ||
    expression.type === 'FunctionExpression' ||
    expression.type === 'JSXElement' ||
    expression.type === 'JSXFragment' ||
    expression.type === 'NewExpression' ||
    expression.type === 'ObjectExpression' ||
    expression.type === 'RegExpLiteral' ||
    (expression.type === 'UnaryExpression' && expression.operator === 'void')
  );
}

function hasExplicitAttribute(
  element: babel.JSXOpeningElement,
  name: string
): boolean {
  return element.attributes.some(
    (attribute) =>
      attribute.type === 'JSXAttribute' &&
      readAttributeName(attribute.name) === name
  );
}

function isMeaningfulJSXChild(
  child: babel.JSXElement['children'][number]
): boolean {
  if (child.type === 'JSXText') return normalizeJSXText(child.value) !== '';
  return !(
    child.type === 'JSXExpressionContainer' &&
    child.expression.type === 'JSXEmptyExpression'
  );
}

function validateVariableElement(
  element: babel.JSXElement,
  component: 'Currency' | 'DateTime' | 'Num' | 'Var',
  context: VueExtractionContext
): void {
  if (context.validatedVariableComponents.has(element)) return;
  context.validatedVariableComponents.add(element);

  const explicitProps = new Set<string>();
  let hasSpread = false;
  for (const attribute of element.openingElement.attributes) {
    if (attribute.type === 'JSXSpreadAttribute') {
      hasSpread = true;
    } else {
      explicitProps.add(readAttributeName(attribute.name));
    }
  }
  if (hasSpread) {
    addVueError(
      context,
      babelLocation(element.openingElement.loc),
      `Found a spread prop on a gt-vue <${component}> component`,
      'Pass variable component props explicitly'
    );
  }
  if (component === 'Var') {
    for (const prop of ['name', 'value']) {
      if (!explicitProps.has(prop)) continue;
      addVueError(
        context,
        babelLocation(element.openingElement.loc),
        `Found unsupported ${prop} prop on a gt-vue <Var> component`,
        'Pass the variable as the default child of <Var>'
      );
    }
    return;
  }
  if (!explicitProps.has('value')) {
    addVueError(
      context,
      babelLocation(element.openingElement.loc),
      `Found a gt-vue <${component}> component without a value prop`,
      `Pass the runtime value through <${component} value={value} />`
    );
  }
  if (hasMeaningfulChildren(element.children)) {
    addVueError(
      context,
      babelLocation(element.loc),
      `Found children on a gt-vue <${component}> component`,
      `Use only the required value prop: <${component} value={value} />`
    );
  }
}

function hasMeaningfulChildren(
  children: babel.JSXElement['children']
): boolean {
  return children.some((child) => {
    if (child.type === 'JSXText') return normalizeJSXText(child.value) !== '';
    return !(
      child.type === 'JSXExpressionContainer' &&
      child.expression.type === 'JSXEmptyExpression'
    );
  });
}

function validateElementAttributes(
  element: babel.JSXOpeningElement,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): void {
  const seenContentProps = new Set<string>();
  for (const attribute of element.attributes) {
    if (attribute.type === 'JSXSpreadAttribute') {
      addVueError(
        context,
        babelLocation(attribute.loc),
        'Found a spread prop inside a gt-vue <T> component in JSX',
        'Pass props by static name so their effect on the translation source is known'
      );
      continue;
    }
    const name = readAttributeName(attribute.name);
    if (isVueJSXDirectiveName(name) && !isSlotsAttribute(attribute)) {
      addVueError(
        context,
        babelLocation(attribute.loc),
        `Found Vue JSX directive "${name}" inside a gt-vue <T> component`,
        'Move the directive outside <T> so the translated VNode source stays static'
      );
      continue;
    }
    if (name === 'innerHTML' || name === 'textContent') {
      addVueError(
        context,
        babelLocation(attribute.loc),
        `Found source-shaping prop "${name}" inside a gt-vue <T> component`,
        'Use static JSX children instead'
      );
      continue;
    }
    const contentProp = (
      Object.values(HTML_CONTENT_PROPS) as readonly string[]
    ).includes(name);
    if (!contentProp) continue;
    if (seenContentProps.has(name)) {
      addVueError(
        context,
        babelLocation(attribute.loc),
        `Found duplicate translatable prop "${name}" inside a gt-vue <T> component`,
        'Pass each translatable element prop once so Vue JSX compiler options cannot change which value is hashed'
      );
      continue;
    }
    seenContentProps.add(name);
    const value = readJSXAttributePrimitive(attribute, scope, analysis);
    if (!value.ok) {
      addVueError(
        context,
        babelLocation(attribute.loc),
        `Found dynamic translatable prop "${name}" inside a gt-vue <T> component`,
        'Use a static string for translatable element props'
      );
    }
  }
}

function isVueJSXDirectiveName(name: string): boolean {
  return /^v(?:-|[A-Z])/.test(name);
}

function readContentProps(
  element: babel.JSXOpeningElement,
  scope: Scope,
  context: VueExtractionContext,
  analysis: VueJSXAnalysis
): GTProp {
  const data: GTProp = {};
  const entries = Object.entries(HTML_CONTENT_PROPS);
  for (const attribute of element.attributes) {
    if (attribute.type !== 'JSXAttribute') continue;
    const name = readAttributeName(attribute.name);
    const entry = entries.find(([, propName]) => propName === name);
    if (!entry) continue;
    const value = readJSXAttributePrimitive(attribute, scope, analysis);
    if (value.ok && typeof value.value === 'string') {
      (data as Record<string, unknown>)[entry[0]] = value.value;
    } else if (!value.ok) {
      // validateElementAttributes owns the single user-facing diagnostic.
      void context;
    }
  }
  return data;
}

function readJSXAttributePrimitive(
  attribute: babel.JSXAttribute,
  scope: Scope,
  analysis: VueJSXAnalysis
): StaticPrimitiveResult {
  if (!attribute.value) return { ok: true, value: true };
  if (attribute.value.type === 'StringLiteral') {
    return { ok: true, value: normalizeJSXText(attribute.value.value) };
  }
  if (
    attribute.value.type !== 'JSXExpressionContainer' ||
    attribute.value.expression.type === 'JSXEmptyExpression'
  ) {
    return { ok: false };
  }
  return analysis.readStaticPrimitive(attribute.value.expression, scope);
}

function resolveElementIdentity(
  name: babel.JSXElement['openingElement']['name'],
  scope: Scope,
  analysis: VueJSXAnalysis
): KnownValue | undefined {
  // Vue JSX emits intrinsic HTML and SVG names as string VNodes before it
  // consults lexical bindings, even when an import uses the same local name.
  if (isNativeElement(name)) return undefined;
  const expression = jsxNameToExpression(name);
  return expression ? analysis.resolveKnownValue(expression, scope) : undefined;
}

function jsxNameToExpression(
  name: babel.JSXElement['openingElement']['name']
): babel.Expression | undefined {
  if (name.type === 'JSXIdentifier') return babel.identifier(name.name);
  if (name.type === 'JSXNamespacedName') return undefined;
  const object = jsxMemberObjectToExpression(name.object);
  return object
    ? babel.memberExpression(object, babel.identifier(name.property.name))
    : undefined;
}

function jsxMemberObjectToExpression(
  object: babel.JSXMemberExpression['object']
): babel.Expression | undefined {
  if (object.type === 'JSXIdentifier') return babel.identifier(object.name);
  const parent = jsxMemberObjectToExpression(object.object);
  return parent
    ? babel.memberExpression(parent, babel.identifier(object.property.name))
    : undefined;
}

function isLiteralFragment(
  name: babel.JSXElement['openingElement']['name']
): boolean {
  // Vue's JSX transforms (verified in 1.4 and 3.0) select the Fragment helper
  // before checking lexical bindings. Consequently literal `<Fragment>` is
  // transparent even when source code declares a same-named local binding.
  return name.type === 'JSXIdentifier' && name.name === 'Fragment';
}

/** Matches Fragment spellings whose runtime VNode flattens authored children. */
function isTransparentFragment(
  name: babel.JSXElement['openingElement']['name'],
  identity: KnownValue | undefined
): boolean {
  return (
    isLiteralFragment(name) ||
    (identity?.type === 'vue-builtin' && identity.name === 'Fragment')
  );
}

/** Detects Fragment aliases the JSX transform compiles through component slots. */
function usesFragmentComponentSlots(
  name: babel.JSXElement['openingElement']['name'],
  identity: KnownValue | undefined
): boolean {
  return (
    identity?.type === 'vue-builtin' &&
    identity.name === 'Fragment' &&
    !isLiteralFragment(name) &&
    !(name.type === 'JSXMemberExpression' && name.property.name === 'Fragment')
  );
}

/** Detects tags whose VNode type can change with plugin `isCustomElement`. */
function isUnboundNonNativeElement(
  name: babel.JSXElement['openingElement']['name'],
  scope: Scope
): boolean {
  if (name.type === 'JSXIdentifier') {
    return (
      name.name !== 'Fragment' &&
      !isNativeElement(name) &&
      !scope.hasBinding(name.name)
    );
  }
  if (name.type === 'JSXNamespacedName') return true;
  let object = name.object;
  while (object.type === 'JSXMemberExpression') object = object.object;
  return !scope.hasBinding(object.name);
}

function isNativeElement(
  name: babel.JSXElement['openingElement']['name']
): boolean {
  return (
    name.type === 'JSXIdentifier' &&
    (isHTMLTag(name.name) || isSVGTag(name.name))
  );
}

/** Proves whether a non-GT JSX tag is an element or component VNode. */
function resolveOrdinaryElementShape(
  name: babel.JSXElement['openingElement']['name'],
  scope: Scope,
  analysis: VueJSXAnalysis,
  seen: Set<babel.Node>
): OrdinaryElementShape | undefined {
  if (isNativeElement(name)) {
    return { component: false, tag: (name as babel.JSXIdentifier).name };
  }
  if (name.type === 'JSXNamespacedName') return undefined;
  if (name.type === 'JSXMemberExpression') {
    let root = name.object;
    while (root.type === 'JSXMemberExpression') root = root.object;
    const binding = scope.getBinding(root.name);
    return binding?.path.isImportSpecifier() ||
      binding?.path.isImportDefaultSpecifier() ||
      binding?.path.isImportNamespaceSpecifier()
      ? { component: true }
      : undefined;
  }
  const binding = scope.getBinding(name.name);
  if (!binding) return undefined;
  if (
    binding.path.isImportSpecifier() ||
    binding.path.isImportDefaultSpecifier() ||
    binding.path.isImportNamespaceSpecifier() ||
    binding.path.isFunctionDeclaration() ||
    binding.path.isClassDeclaration()
  ) {
    return { component: true };
  }
  const declaration = binding.path.node;
  return declaration.type === 'VariableDeclarator' && declaration.init
    ? resolveOrdinaryElementExpression(
        declaration.init,
        binding.path.scope,
        analysis,
        seen
      )
    : undefined;
}

/** Classifies a retained tag expression without executing application code. */
function resolveOrdinaryElementExpression(
  input: babel.Expression,
  scope: Scope,
  analysis: VueJSXAnalysis,
  seen: Set<babel.Node>
): OrdinaryElementShape | undefined {
  const expression = unwrapExpression(input);
  if (!expression || seen.has(expression)) return undefined;
  const nextSeen = new Set(seen);
  nextSeen.add(expression);

  const primitive = analysis.readStaticPrimitive(expression, scope);
  if (primitive.ok) {
    return typeof primitive.value === 'string'
      ? { component: false, tag: primitive.value }
      : undefined;
  }
  if (
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'FunctionExpression' ||
    expression.type === 'ClassExpression' ||
    expression.type === 'ObjectExpression'
  ) {
    return { component: true };
  }
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) return undefined;
    if (
      binding.path.isImportSpecifier() ||
      binding.path.isImportDefaultSpecifier() ||
      binding.path.isImportNamespaceSpecifier() ||
      binding.path.isFunctionDeclaration() ||
      binding.path.isClassDeclaration()
    ) {
      return { component: true };
    }
    const declaration = binding.path.node;
    return declaration.type === 'VariableDeclarator' && declaration.init
      ? resolveOrdinaryElementExpression(
          declaration.init,
          binding.path.scope,
          analysis,
          nextSeen
        )
      : undefined;
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    if (expression.callee.type === 'V8IntrinsicIdentifier') return undefined;
    const callee = analysis.resolveKnownValue(expression.callee, scope);
    if (callee?.type === 'defineComponent') return { component: true };
    const argument = expression.arguments[0];
    return callee?.type === 'identity' &&
      expression.arguments.length === 1 &&
      argument &&
      argument.type !== 'SpreadElement' &&
      argument.type !== 'ArgumentPlaceholder'
      ? resolveOrdinaryElementExpression(argument, scope, analysis, nextSeen)
      : undefined;
  }
  if (expression.type === 'ConditionalExpression') {
    return mergeOrdinaryElementShapes(
      resolveOrdinaryElementExpression(
        expression.consequent,
        scope,
        analysis,
        nextSeen
      ),
      resolveOrdinaryElementExpression(
        expression.alternate,
        scope,
        analysis,
        nextSeen
      )
    );
  }
  if (expression.type === 'LogicalExpression') {
    return mergeOrdinaryElementShapes(
      resolveOrdinaryElementExpression(
        expression.left,
        scope,
        analysis,
        nextSeen
      ),
      resolveOrdinaryElementExpression(
        expression.right,
        scope,
        analysis,
        nextSeen
      )
    );
  }
  if (expression.type === 'SequenceExpression') {
    const last = expression.expressions.at(-1);
    return last
      ? resolveOrdinaryElementExpression(last, scope, analysis, nextSeen)
      : undefined;
  }
  return undefined;
}

/** Combines alternate tags only when they preserve traversal semantics. */
function mergeOrdinaryElementShapes(
  left: OrdinaryElementShape | undefined,
  right: OrdinaryElementShape | undefined
): OrdinaryElementShape | undefined {
  if (!left || !right || left.component !== right.component) return undefined;
  return {
    component: left.component,
    ...(left.tag === right.tag && left.tag !== undefined && { tag: left.tag }),
  };
}

function readElementDisplayName(
  name: babel.JSXElement['openingElement']['name']
): string | undefined {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXNamespacedName') return undefined;
  const object = readMemberDisplayName(name.object);
  return object ? `${object}.${name.property.name}` : undefined;
}

function readMemberDisplayName(
  object: babel.JSXMemberExpression['object']
): string | undefined {
  if (object.type === 'JSXIdentifier') return object.name;
  const parent = readMemberDisplayName(object.object);
  return parent ? `${parent}.${object.property.name}` : undefined;
}

function readAttributeName(name: babel.JSXAttribute['name']): string {
  return name.type === 'JSXIdentifier'
    ? name.name
    : `${name.namespace.name}:${name.name.name}`;
}

/** Mirrors `@vue/babel-plugin-jsx`'s JSX text and string-prop transform. */
function normalizeJSXText(text: string): string {
  const lines = text.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (/[^ \t]/.test(lines[index]!)) lastNonEmptyLine = index;
  }

  let result = '';
  for (let index = 0; index < lines.length; index += 1) {
    const isFirstLine = index === 0;
    const isLastLine = index === lines.length - 1;
    const isLastNonEmptyLine = index === lastNonEmptyLine;
    let line = lines[index]!.replace(/\t/g, ' ');
    if (!isFirstLine) line = line.replace(/^ +/, '');
    if (!isLastLine) line = line.replace(/ +$/, '');
    if (!line) continue;
    if (!isLastNonEmptyLine) line += ' ';
    result += line;
  }
  return result;
}

function appendSerializedChild(
  result: SerializedJSXChild[],
  child: SerializedJSXChild
): void {
  if (child === jsxTextBoundary) {
    if (result.at(-1) !== jsxTextBoundary) result.push(child);
    return;
  }
  // React preserves each authored child as a separate array entry, including
  // adjacent string expressions. gt-vue's runtime does the same for distinct
  // Vue Text VNodes, so merging here would change the persisted source hash.
  result.push(child);
}

function collapseChildren(children: SerializedJSXChild[]): JsxChildren {
  const visibleChildren = children.filter(
    (child): child is JsxChild => child !== jsxTextBoundary
  );
  return visibleChildren.length === 1 ? visibleChildren[0]! : visibleChildren;
}
