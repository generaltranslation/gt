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
import {
  appendTemplatePath,
  recursiveTemplatePathSegment,
  unknownTemplatePathSegment,
} from './templatePath.js';
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
  /** Number of VNode roots Vue produces before Suspense normalization. */
  rootCount: number;
  shadowed: Set<string>;
};

type SlotLayout = {
  defaultSlot: SlotContent;
  namedSlots: Map<string, SlotContent>;
};

type DynamicSelectorCandidate = {
  kind: 'expression' | 'string';
  name: string;
};

type DynamicSelectorContainer =
  | {
      kind: 'literal';
      node: babel.ArrayExpression | babel.ObjectExpression;
    }
  | { kind: 'path'; path: string }
  | {
      /** A callback-created container whose children are abstract values. */
      kind: 'analysis';
      containerKind: 'array' | 'object';
      members?: Map<string, Omit<DynamicSelectorAnalysis, 'displayName'>>;
      values: Omit<DynamicSelectorAnalysis, 'displayName'>;
    };

type DynamicSelectorAnalysis = {
  candidates: DynamicSelectorCandidate[];
  componentFactories: Set<string>;
  containers: DynamicSelectorContainer[];
  displayName: string;
  gtComponentFactories: Set<string>;
  possibleGT: boolean;
  unknown: boolean;
};

const COMPONENT_SELECTING_ARRAY_METHODS = new Set([
  'at',
  'find',
  'findLast',
  'pop',
  'shift',
]);

const COMPONENT_PRESERVING_ARRAY_METHODS = new Set([
  'concat',
  'filter',
  'reverse',
  'slice',
  'sort',
  'splice',
  'toReversed',
  'toSorted',
  'toSpliced',
]);

type ForParseResult = {
  index?: SimpleExpressionNode;
  key?: SimpleExpressionNode;
  source?: SimpleExpressionNode;
  value?: SimpleExpressionNode;
};

type TemplateBindingPattern =
  | babel.ArrayPattern
  | babel.AssignmentPattern
  | babel.Identifier
  | babel.ObjectPattern
  | babel.RestElement;

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
    const possibleScopedComponents = collectPossibleScopedComponentAliases(
      child,
      bindings,
      shadowed,
      expressionPlugins
    );
    const possibleScopedContainers = collectPossibleScopedContainerAliases(
      child,
      bindings,
      shadowed,
      expressionPlugins
    );
    const componentBindings =
      possibleScopedComponents.size > 0
        ? createScopedComponentBindings(bindings, possibleScopedComponents)
        : bindings;
    const childBindings =
      possibleScopedContainers.size > 0
        ? createScopedContainerBindings(
            componentBindings,
            possibleScopedContainers,
            shadowed
          )
        : componentBindings;
    const childShadowed = unionSets(shadowed, localBindings);
    for (const localName of [
      ...possibleScopedComponents,
      ...possibleScopedContainers.keys(),
    ]) {
      childShadowed.delete(localName);
    }

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
            childBindings,
            expressionPlugins,
            context
          );
        }
      } else if (property.name === 'slot') {
        processBindingDefaults(
          property.exp,
          childShadowed,
          childBindings,
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
          childBindings,
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
        property.name === 'if' || property.name === 'else-if'
          ? bindings
          : childBindings,
        expressionPlugins,
        context
      );
    }

    const component = resolveGTComponent(
      child,
      childBindings,
      expressionPlugins,
      childShadowed
    );
    const suspense = resolveSuspenseComponent(
      child,
      childBindings,
      expressionPlugins,
      childShadowed
    );
    const uncertainGTComponent = resolveUncertainComponentBinding(
      child,
      childBindings,
      childBindings.uncertainGTComponents,
      childBindings.uncertainRegisteredGTComponents,
      childBindings.gtComponentFactories,
      expressionPlugins,
      childShadowed
    );
    const possibleDynamicT = component
      ? undefined
      : resolvePossibleDynamicT(
          child,
          childBindings,
          expressionPlugins,
          childShadowed
        );
    const unresolvedGTComponent = uncertainGTComponent ?? possibleDynamicT;
    if (!insideTranslation && !component && unresolvedGTComponent) {
      addVueError(
        context,
        child.loc,
        `Could not statically resolve possible gt-vue component alias "${unresolvedGTComponent}"`,
        'Use a direct gt-vue import or an immutable alias that does not escape static analysis'
      );
    }
    if (component?.originalName === 'T' && !insideTranslation) {
      extractTranslationComponent(
        child,
        childShadowed,
        childBindings,
        expressionPlugins,
        context
      );
    }

    const childInsideTranslation =
      component?.originalName === 'Var' ||
      (insideTranslation && isOpaqueComponent(child, component, suspense))
        ? false
        : insideTranslation || component?.originalName === 'T';
    if (childInsideTranslation && suspense) {
      const suspenseElementIsFallback = hasStaticSlotName(child, 'fallback');
      for (const suspenseChild of child.children) {
        visitTemplateChildren(
          [suspenseChild],
          childShadowed,
          childBindings,
          expressionPlugins,
          context,
          suspenseElementIsFallback
            ? false
            : !isSuspenseFallbackTemplate(suspenseChild)
        );
      }
    } else {
      visitTemplateChildren(
        child.children,
        childShadowed,
        childBindings,
        expressionPlugins,
        context,
        childInsideTranslation
      );
    }
  }
}

/** Finds local Vue aliases whose runtime value can be a GT component. */
function collectPossibleScopedComponentAliases(
  element: ElementNode,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  expressionPlugins: ParserPlugin[]
): Set<string> {
  const aliases = new Set<string>();
  for (const property of element.props) {
    if (property.type !== NodeTypes.DIRECTIVE) continue;
    if (property.name === 'for') {
      const parseResult = (
        property as DirectiveNode & { forParseResult?: ForParseResult }
      ).forParseResult;
      const pattern = parseResult?.value
        ? parseTemplateBindingPattern(parseResult.value, expressionPlugins)
        : undefined;
      const source = parseResult?.source
        ? getExpressionNode(parseResult.source, expressionPlugins)
        : undefined;
      if (!pattern || !source) continue;
      const values = collectTemplateContainerCandidates(
        source,
        bindings,
        shadowed,
        new Set()
      );
      collectPossiblePatternComponents(
        pattern,
        values,
        bindings,
        shadowed,
        aliases
      );
      continue;
    }
    if (
      property.name !== 'slot' ||
      property.exp?.type !== NodeTypes.SIMPLE_EXPRESSION ||
      !property.exp.content
    ) {
      continue;
    }
    try {
      const arrow = parseExpression(`(${property.exp.content}) => 0`, {
        plugins: expressionPlugins,
      });
      if (arrow.type !== 'ArrowFunctionExpression') continue;
      for (const parameter of arrow.params) {
        collectPossibleComponentDefaults(
          parameter,
          bindings,
          shadowed,
          aliases
        );
      }
    } catch {
      // Vue's compiler reports malformed slot patterns separately.
    }
  }
  return aliases;
}

/** Collects v-for aliases whose runtime value can itself be a container. */
function collectPossibleScopedContainerAliases(
  element: ElementNode,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  expressionPlugins: ParserPlugin[]
): Map<string, Omit<DynamicSelectorAnalysis, 'displayName'>> {
  const aliases = new Map<
    string,
    Omit<DynamicSelectorAnalysis, 'displayName'>
  >();
  for (const property of element.props) {
    if (property.type !== NodeTypes.DIRECTIVE || property.name !== 'for') {
      continue;
    }
    const parseResult = (
      property as DirectiveNode & { forParseResult?: ForParseResult }
    ).forParseResult;
    const pattern = parseResult?.value
      ? parseTemplateBindingPattern(parseResult.value, expressionPlugins)
      : undefined;
    const source = parseResult?.source
      ? getExpressionNode(parseResult.source, expressionPlugins)
      : undefined;
    if (!pattern || !source) continue;
    collectPossiblePatternContainers(
      pattern,
      collectTemplateContainerCandidates(source, bindings, shadowed, new Set()),
      bindings,
      shadowed,
      aliases
    );
  }
  return aliases;
}

/** Projects container alternatives through one v-for binding pattern. */
function collectPossiblePatternContainers(
  pattern: TemplateBindingPattern,
  values: Omit<DynamicSelectorAnalysis, 'displayName'>,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  aliases: Map<string, Omit<DynamicSelectorAnalysis, 'displayName'>>
): void {
  if (pattern.type === 'Identifier') {
    if (values.containers.length === 0) return;
    const existing = aliases.get(pattern.name);
    aliases.set(
      pattern.name,
      existing ? mergeDynamicSelectorAnalyses([existing, values]) : values
    );
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    if (!isTemplateBindingPattern(pattern.left)) return;
    collectPossiblePatternContainers(
      pattern.left,
      values,
      bindings,
      shadowed,
      aliases
    );
    collectPossiblePatternContainers(
      pattern.left,
      collectDynamicSelectorCandidates(
        pattern.right,
        bindings,
        shadowed,
        new Set()
      ),
      bindings,
      shadowed,
      aliases
    );
    return;
  }
  if (pattern.type === 'RestElement') {
    if (isTemplateBindingPattern(pattern.argument)) {
      collectPossiblePatternContainers(
        pattern.argument,
        values,
        bindings,
        shadowed,
        aliases
      );
    }
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      const target =
        property.type === 'RestElement' ? property.argument : property.value;
      if (!isTemplateBindingPattern(target)) continue;
      collectPossiblePatternContainers(
        target,
        property.type === 'RestElement'
          ? values
          : selectPossibleContainerChildren(
              values,
              readTemplateLiteralPropertyKey(property, bindings, shadowed),
              bindings,
              shadowed
            ),
        bindings,
        shadowed,
        aliases
      );
    }
    return;
  }
  pattern.elements.forEach((element, index) => {
    if (!element || !isTemplateBindingPattern(element)) return;
    collectPossiblePatternContainers(
      element,
      selectPossibleContainerChildren(
        values,
        element.type === 'RestElement' ? undefined : String(index),
        bindings,
        shadowed
      ),
      bindings,
      shadowed,
      aliases
    );
  });
}

/** Parses a Vue alias expression as one JavaScript binding pattern. */
function parseTemplateBindingPattern(
  expression: SimpleExpressionNode,
  expressionPlugins: ParserPlugin[]
): TemplateBindingPattern | undefined {
  try {
    const arrow = parseExpression(`(${expression.content}) => 0`, {
      plugins: expressionPlugins,
    });
    const parameter =
      arrow.type === 'ArrowFunctionExpression' && arrow.params.length === 1
        ? arrow.params[0]
        : undefined;
    return parameter && isTemplateBindingPattern(parameter)
      ? parameter
      : undefined;
  } catch {
    return undefined;
  }
}

/** Projects possible iterable values through a v-for destructuring pattern. */
function collectPossiblePatternComponents(
  pattern: TemplateBindingPattern,
  values: Omit<DynamicSelectorAnalysis, 'displayName'>,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  aliases: Set<string>
): void {
  if (pattern.type === 'Identifier') {
    if (selectorAnalysisMayContainGT(values, bindings)) {
      aliases.add(pattern.name);
    }
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    if (!isTemplateBindingPattern(pattern.left)) return;
    collectPossiblePatternComponents(
      pattern.left,
      values,
      bindings,
      shadowed,
      aliases
    );
    const fallback = collectDynamicSelectorCandidates(
      pattern.right,
      bindings,
      shadowed,
      new Set()
    );
    collectPossiblePatternComponents(
      pattern.left,
      fallback,
      bindings,
      shadowed,
      aliases
    );
    return;
  }
  if (pattern.type === 'RestElement') {
    if (!isTemplateBindingPattern(pattern.argument)) return;
    collectPossiblePatternComponents(
      pattern.argument,
      values,
      bindings,
      shadowed,
      aliases
    );
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        if (isTemplateBindingPattern(property.argument)) {
          collectPossiblePatternComponents(
            property.argument,
            values,
            bindings,
            shadowed,
            aliases
          );
        }
        continue;
      }
      const key = readTemplateLiteralPropertyKey(property, bindings, shadowed);
      const selected = selectPossibleContainerChildren(
        values,
        key,
        bindings,
        shadowed
      );
      if (isTemplateBindingPattern(property.value)) {
        collectPossiblePatternComponents(
          property.value,
          selected,
          bindings,
          shadowed,
          aliases
        );
      }
    }
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    pattern.elements.forEach((element, index) => {
      if (!element) return;
      const selected = selectPossibleContainerChildren(
        values,
        element.type === 'RestElement' ? undefined : String(index),
        bindings,
        shadowed
      );
      if (isTemplateBindingPattern(element)) {
        collectPossiblePatternComponents(
          element,
          selected,
          bindings,
          shadowed,
          aliases
        );
      }
    });
  }
}

function isTemplateBindingPattern(
  node: babel.Node
): node is TemplateBindingPattern {
  return (
    node.type === 'ArrayPattern' ||
    node.type === 'AssignmentPattern' ||
    node.type === 'Identifier' ||
    node.type === 'ObjectPattern' ||
    node.type === 'RestElement'
  );
}

/** Selects from every possible container carried by an abstract value. */
function selectPossibleContainerChildren(
  values: Omit<DynamicSelectorAnalysis, 'displayName'>,
  key: string | undefined,
  bindings: TemplateBindings,
  shadowed: Set<string>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const selected = values.containers.map((container) =>
    selectTemplateContainerReference(
      container,
      key,
      bindings,
      shadowed,
      new Set()
    )
  );
  return selected.length > 0
    ? mergeDynamicSelectorAnalyses(selected)
    : emptyDynamicSelectorAnalysis(true);
}

/** Walks one binding pattern and records GT-bearing default expressions. */
function collectPossibleComponentDefaults(
  pattern: babel.Node,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  aliases: Set<string>
): void {
  if (pattern.type === 'AssignmentPattern') {
    if (pattern.left.type === 'Identifier') {
      const analysis = collectDynamicSelectorCandidates(
        pattern.right,
        bindings,
        shadowed,
        new Set()
      );
      if (selectorAnalysisMayContainGT(analysis, bindings)) {
        aliases.add(pattern.left.name);
      }
    }
    collectPossibleComponentDefaults(pattern.left, bindings, shadowed, aliases);
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      collectPossibleComponentDefaults(
        property.type === 'RestElement' ? property.argument : property.value,
        bindings,
        shadowed,
        aliases
      );
    }
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) {
        collectPossibleComponentDefaults(element, bindings, shadowed, aliases);
      }
    }
    return;
  }
  if (pattern.type === 'RestElement') {
    collectPossibleComponentDefaults(
      pattern.argument,
      bindings,
      shadowed,
      aliases
    );
  }
}

/** Returns whether an abstract selector value can resolve to any GT component. */
function selectorAnalysisMayContainGT(
  analysis: Omit<DynamicSelectorAnalysis, 'displayName'>,
  bindings: TemplateBindings
): boolean {
  if (analysis.possibleGT || analysis.gtComponentFactories.size > 0) {
    return true;
  }
  return analysis.candidates.some((candidate) => {
    if (candidate.kind === 'expression') {
      return (
        bindings.components.get(candidate.name) === 'T' ||
        bindings.uncertainGTComponents.has(candidate.name)
      );
    }
    return [...normalizeTemplateBindingNames(candidate.name)].some(
      (name) => bindings.registeredComponents.get(name) === 'T'
    );
  });
}

/** Shadows program bindings with one local alias of uncertain GT identity. */
function createScopedComponentBindings(
  bindings: TemplateBindings,
  aliases: Set<string>
): TemplateBindings {
  const scoped: TemplateBindings = {
    ...bindings,
    arrayLengths: new Map(bindings.arrayLengths),
    componentFactories: new Set(bindings.componentFactories),
    components: new Map(bindings.components),
    containerKinds: new Map(bindings.containerKinds),
    possibleGTContainers: new Set(bindings.possibleGTContainers),
    gtContainerFactories: new Set(bindings.gtContainerFactories),
    directBindings: new Set(bindings.directBindings),
    gtComponentFactories: new Set(bindings.gtComponentFactories),
    identityFunctions: new Set(bindings.identityFunctions),
    possibleStaticStrings: new Map(
      [...bindings.possibleStaticStrings].map(([name, values]) => [
        name,
        new Set(values),
      ])
    ),
    staticValues: new Map(bindings.staticValues),
    stringFunctions: new Map(bindings.stringFunctions),
    uncertainComponents: new Set(bindings.uncertainComponents),
    uncertainGTComponents: new Set(bindings.uncertainGTComponents),
    uncertainStringFunctions: new Set(bindings.uncertainStringFunctions),
    vueBuiltins: new Map(bindings.vueBuiltins),
  };
  for (const alias of aliases) {
    clearScopedPath(scoped.arrayLengths, alias);
    clearScopedPath(scoped.componentFactories, alias);
    clearScopedPath(scoped.components, alias);
    clearScopedPath(scoped.containerKinds, alias);
    clearScopedPath(scoped.possibleGTContainers, alias);
    clearScopedPath(scoped.gtContainerFactories, alias);
    clearScopedPath(scoped.gtComponentFactories, alias);
    clearScopedPath(scoped.identityFunctions, alias);
    clearScopedPath(scoped.possibleStaticStrings, alias);
    clearScopedPath(scoped.staticValues, alias);
    clearScopedPath(scoped.stringFunctions, alias);
    clearScopedPath(scoped.uncertainComponents, alias);
    clearScopedPath(scoped.uncertainGTComponents, alias);
    clearScopedPath(scoped.uncertainStringFunctions, alias);
    clearScopedPath(scoped.vueBuiltins, alias);
    scoped.directBindings.add(alias);
    scoped.uncertainComponents.add(alias);
    scoped.uncertainGTComponents.add(alias);
  }
  return scoped;
}

/** Exposes container-valued v-for aliases to nested template scopes. */
function createScopedContainerBindings(
  bindings: TemplateBindings,
  aliases: Map<string, Omit<DynamicSelectorAnalysis, 'displayName'>>,
  shadowed: Set<string>
): TemplateBindings {
  const scoped = createScopedComponentBindings(bindings, new Set());
  for (const [alias, values] of aliases) {
    clearScopedPath(scoped.arrayLengths, alias);
    clearScopedPath(scoped.componentFactories, alias);
    clearScopedPath(scoped.components, alias);
    clearScopedPath(scoped.containerKinds, alias);
    clearScopedPath(scoped.possibleGTContainers, alias);
    clearScopedPath(scoped.gtContainerFactories, alias);
    clearScopedPath(scoped.gtComponentFactories, alias);
    clearScopedPath(scoped.identityFunctions, alias);
    clearScopedPath(scoped.possibleStaticStrings, alias);
    clearScopedPath(scoped.staticValues, alias);
    clearScopedPath(scoped.stringFunctions, alias);
    clearScopedPath(scoped.uncertainComponents, alias);
    clearScopedPath(scoped.uncertainGTComponents, alias);
    clearScopedPath(scoped.uncertainStringFunctions, alias);
    clearScopedPath(scoped.vueBuiltins, alias);
    scoped.directBindings.add(alias);

    const expose = (
      container: DynamicSelectorContainer,
      path: string,
      depth: number
    ): void => {
      if (depth > 32) return;
      const kind =
        container.kind === 'literal'
          ? container.node.type === 'ArrayExpression'
            ? 'array'
            : 'object'
          : container.kind === 'analysis'
            ? container.containerKind
            : scoped.containerKinds.get(container.path);
      if (kind) scoped.containerKinds.set(path, kind);
      const children = selectTemplateContainerReference(
        container,
        undefined,
        scoped,
        shadowed,
        new Set()
      );
      if (selectorAnalysisMayContainGT(children, scoped)) {
        scoped.possibleGTContainers.add(path);
      }
      const childPath = appendTemplatePath(path, unknownTemplatePathSegment);
      for (const child of children.containers) {
        expose(child, childPath, depth + 1);
      }
    };
    for (const container of values.containers) expose(container, alias, 0);
  }
  return scoped;
}

function clearScopedPath(
  collection: Map<string, unknown> | Set<string>,
  path: string
): void {
  for (const key of collection.keys()) {
    if (key === path || key.startsWith(`${path}.`)) collection.delete(key);
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
      if (!kind) {
        reportPossibleTemplateStringFunction(
          path.node.callee,
          path.scope,
          location,
          shadowed,
          bindings,
          context
        );
        return;
      }
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
      if (!kind) {
        reportPossibleTemplateStringFunction(
          path.node.callee,
          path.scope,
          location,
          shadowed,
          bindings,
          context
        );
        return;
      }
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
      if (!kind) {
        reportPossibleTemplateStringFunction(
          path.node.tag,
          path.scope,
          location,
          shadowed,
          bindings,
          context
        );
        return;
      }
      addVueError(
        context,
        location,
        'Found an unsupported tagged template translation in gt-vue',
        'Call the translation function with a string literal instead'
      );
    },
  });
}

/** Reports a call whose binding may be a gt-vue string translator. */
function reportPossibleTemplateStringFunction(
  input: babel.Node,
  scope: Scope,
  location: ExtractionLocation,
  shadowed: Set<string>,
  bindings: TemplateBindings,
  context: VueExtractionContext
): void {
  const displayName = resolvePossibleTemplateStringFunction(
    input,
    scope,
    shadowed,
    bindings
  );
  if (!displayName) return;
  addVueError(
    context,
    location,
    `Could not statically resolve possible gt-vue translation function alias "${displayName}"`,
    'Use a direct gt-vue import or an immutable translator alias that does not escape static analysis'
  );
}

/** Resolves direct or dynamically selected uncertain translator paths. */
function resolvePossibleTemplateStringFunction(
  input: babel.Node,
  scope: Scope,
  shadowed: Set<string>,
  bindings: TemplateBindings
): string | undefined {
  const node = unwrapExpression(input);
  if (!node) return undefined;
  const path = readStaticTemplateMemberPath(node, bindings, shadowed);
  const root = path?.split('.', 1)[0];
  if (
    path &&
    root &&
    !scope.hasBinding(root) &&
    bindings.uncertainStringFunctions.has(path)
  ) {
    return path;
  }
  if (
    node.type !== 'MemberExpression' &&
    node.type !== 'OptionalMemberExpression'
  ) {
    return undefined;
  }
  const objectPath = readStaticTemplateMemberPath(
    node.object,
    bindings,
    shadowed
  );
  const objectRoot = objectPath?.split('.', 1)[0];
  if (!objectPath || !objectRoot || scope.hasBinding(objectRoot)) {
    return undefined;
  }
  const prefix = `${objectPath}.`;
  const hasPossibleChild = [
    ...bindings.stringFunctions.keys(),
    ...bindings.uncertainStringFunctions,
  ].some((name) => {
    if (!name.startsWith(prefix)) return false;
    const suffix = name.slice(prefix.length);
    return !suffix.includes('.');
  });
  return hasPossibleChild ? objectPath : undefined;
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
  const path = readStaticTemplateMemberPath(node, bindings, shadowed);
  const root = path?.split('.', 1)[0];
  return root && !scope.hasBinding(root)
    ? bindings.stringFunctions.get(path)
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
    if (key === undefined) {
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
  validateCommentWhitespaceParity(children, context);
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

/**
 * Rejects comments whose removal can change Vue's surrounding whitespace.
 *
 * Vue keeps template comments in development and strips them in production.
 * The compiler's whitespace transform can therefore produce different text
 * VNodes, and consequently different persisted translation hashes, across
 * Vue versions and build modes. Restrict this check to children that are
 * actually serialized so comments in opaque or unused slots remain opaque.
 */
function validateCommentWhitespaceParity(
  children: TemplateChildNode[],
  context: VueExtractionContext
): void {
  for (const child of children) {
    if (child.type !== NodeTypes.COMMENT) continue;
    const before = context.source[child.loc.start.offset - 1];
    const after = context.source[child.loc.end.offset];
    if (!isHtmlWhitespace(before) && !isHtmlWhitespace(after)) continue;
    addVueError(
      context,
      child.loc,
      'Found a comment adjacent to translatable whitespace inside a gt-vue <T> component',
      'Remove the adjacent whitespace or move the comment outside the translated content'
    );
  }
}

/** Matches the whitespace characters normalized by the Vue HTML compiler. */
function isHtmlWhitespace(value: string | undefined): boolean {
  return value !== undefined && /[\t\n\f\r ]/.test(value);
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
  const suspense = resolveSuspenseComponent(
    element,
    bindings,
    expressionPlugins,
    shadowed
  );
  const uncertainComponent =
    !component && !suspense
      ? resolveUncertainComponent(
          element,
          bindings,
          expressionPlugins,
          shadowed
        )
      : undefined;
  if (uncertainComponent) {
    addVueError(
      context,
      element.loc,
      `Could not statically resolve component alias "${uncertainComponent}" inside a gt-vue <T> component`,
      'Use a direct component import or an immutable alias that does not escape static analysis'
    );
  }
  validateRichElement(
    element,
    context,
    Boolean(component || suspense || uncertainComponent)
  );
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
  if (isOpaqueComponent(element, component, suspense)) {
    return {
      t: element.tag,
      i: id,
      ...(Object.keys(data).length > 0 && { d: data }),
    };
  }

  const slotLayout =
    element.tagType === ElementTypes.COMPONENT
      ? getSlotLayout(element, shadowed, expressionPlugins, context)
      : {
          defaultSlot: {
            children: element.children,
            rootCount: countVueSlotRoots(element.children),
            shadowed,
          },
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
  if (suspense && slotLayout.defaultSlot.rootCount > 1) {
    addVueError(
      context,
      element.loc,
      'Found more than one default root inside Vue <Suspense> within a gt-vue <T> component',
      'Wrap the Suspense default content in a single element or move <T> inside <Suspense>'
    );
  }

  const unsupportedNamedSlots = [...slotLayout.namedSlots].filter(
    ([name]) => !suspense || name !== 'fallback'
  );
  if (
    unsupportedNamedSlots.length > 0 &&
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
    t: originalName ?? suspense?.originalName ?? element.tag,
    i: id,
    ...(Object.keys(data).length > 0 && { d: data }),
    ...(children.length > 0 && { c: collapseChildren(children) }),
  };
}

/** Returns true when the runtime preserves a component's slots as opaque. */
function isOpaqueComponent(
  element: ElementNode,
  component?: { localName: string; originalName: GTComponentName },
  suspense?: { localName: string; originalName: 'Suspense' }
): boolean {
  return element.tagType === ElementTypes.COMPONENT && !component && !suspense;
}

/** Resolves literal Suspense and statically proven aliases of Vue's builtin. */
function resolveSuspenseComponent(
  element: ElementNode,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>
): { localName: string; originalName: 'Suspense' } | undefined {
  if (
    element.tagType === ElementTypes.COMPONENT &&
    element.tag.toLowerCase() === 'suspense'
  ) {
    return { localName: element.tag, originalName: 'Suspense' };
  }
  return resolveComponentBinding(
    element,
    bindings,
    bindings.vueBuiltins,
    bindings.registeredVueBuiltins,
    bindings.directBindings,
    expressionPlugins,
    shadowed
  );
}

/** Resolves a component-shaped binding whose exact identity is uncertain. */
function resolveUncertainComponent(
  element: ElementNode,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>
): string | undefined {
  return resolveUncertainComponentBinding(
    element,
    bindings,
    bindings.uncertainComponents,
    bindings.uncertainRegisteredComponents,
    bindings.componentFactories,
    expressionPlugins,
    shadowed
  );
}

/** Resolves uncertainty while preserving direct versus registered precedence. */
function resolveUncertainComponentBinding(
  element: ElementNode,
  bindings: TemplateBindings,
  uncertainDirectBindings: Set<string>,
  uncertainRegisteredBindings: Set<string>,
  uncertainFactories: Set<string>,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>
): string | undefined {
  if (element.tagType !== ElementTypes.COMPONENT) return undefined;
  const selector = readDynamicComponentSelector(
    element,
    expressionPlugins,
    bindings,
    shadowed
  );
  if (selector) {
    if (
      [...selector.componentFactories].some((name) =>
        uncertainFactories.has(name)
      ) ||
      [...selector.gtComponentFactories].some((name) =>
        uncertainFactories.has(name)
      )
    ) {
      return selector.displayName;
    }
    for (const candidate of selector.candidates) {
      for (const localName of normalizeTemplateBindingNames(candidate.name)) {
        if (
          candidate.kind === 'string'
            ? uncertainRegisteredBindings.has(localName)
            : uncertainDirectBindings.has(localName)
        ) {
          return localName;
        }
      }
    }
    return undefined;
  }
  for (const localName of normalizeTemplateBindingNames(element.tag)) {
    const direct = uncertainDirectBindings.has(localName);
    const registered = uncertainRegisteredBindings.has(localName);
    if (isDirectTemplateBinding(localName, bindings.directBindings)) {
      if (direct) return localName;
    } else if (registered || direct) {
      return localName;
    }
  }
  return undefined;
}

/** Detects an unresolved dynamic selector whose possible result includes T. */
function resolvePossibleDynamicT(
  element: ElementNode,
  bindings: TemplateBindings,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>
): string | undefined {
  const selector = readDynamicComponentSelector(
    element,
    expressionPlugins,
    bindings,
    shadowed
  );
  if (!selector) return undefined;
  if (selector.possibleGT || selector.gtComponentFactories.size > 0) {
    return selector.displayName;
  }
  for (const candidate of selector.candidates) {
    for (const localName of normalizeTemplateBindingNames(candidate.name)) {
      const component =
        candidate.kind === 'string'
          ? bindings.registeredComponents.get(localName)
          : bindings.components.get(localName);
      if (component === 'T') return selector.displayName;
    }
  }
  return undefined;
}

/** Identifies a statically named Suspense fallback slot during tree walking. */
function isSuspenseFallbackTemplate(child: TemplateChildNode): boolean {
  return (
    child.type === NodeTypes.ELEMENT &&
    child.tag === 'template' &&
    hasStaticSlotName(child, 'fallback')
  );
}

/** Matches one statically named slot directive without emitting diagnostics. */
function hasStaticSlotName(element: ElementNode, name: string): boolean {
  const directive = element.props.find(
    (property): property is DirectiveNode =>
      property.type === NodeTypes.DIRECTIVE && property.name === 'slot'
  );
  return (
    directive?.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
    directive.arg.isStatic &&
    directive.arg.content === name
  );
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
    if (key === undefined) continue;
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
  let defaultSlot: SlotContent = { children: [], rootCount: 0, shadowed };
  let hasTemplateSlots = false;
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
      defaultSlot = {
        children: element.children,
        rootCount: countVueSlotRoots(element.children),
        shadowed: slotShadowed,
      };
    } else if (slotName) {
      namedSlots.set(slotName, {
        children: element.children,
        rootCount: countVueSlotRoots(element.children),
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
      defaultChildren.push(child);
      continue;
    }
    hasTemplateSlots = true;

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
      if (hasMeaningfulSlotContent(defaultChildren) || hasExplicitDefaultSlot) {
        addVueError(
          context,
          child.loc,
          'Found more than one default slot definition inside a gt-vue translation',
          'Use a single default slot'
        );
        reportedDefaultConflict = true;
      }
      hasExplicitDefaultSlot = true;
      defaultSlot = {
        children: child.children,
        rootCount: countVueSlotRoots(child.children),
        shadowed: slotShadowed,
      };
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
        rootCount: countVueSlotRoots(child.children),
        shadowed: slotShadowed,
      });
    }
  }

  const hasMeaningfulDefault = hasMeaningfulSlotContent(defaultChildren);
  if (
    hasExplicitDefaultSlot &&
    hasMeaningfulDefault &&
    !reportedDefaultConflict
  ) {
    addVueError(
      context,
      defaultChildren[0].loc,
      'Found more than one default slot definition inside a gt-vue translation',
      'Use a single default slot'
    );
  } else if (
    !hasExplicitDefaultSlot &&
    defaultChildren.length > 0 &&
    (!hasTemplateSlots || hasMeaningfulDefault)
  ) {
    defaultSlot = {
      children: defaultChildren,
      rootCount: countImplicitSlotRoots(element.children),
      shadowed,
    };
  }
  return { defaultSlot, namedSlots };
}

/** Matches Vue's test for an implicit slot containing more than separators. */
function hasMeaningfulSlotContent(children: TemplateChildNode[]): boolean {
  return children.some(
    (child) =>
      child.type !== NodeTypes.COMMENT &&
      (child.type !== NodeTypes.TEXT || child.content.trim().length > 0)
  );
}

/** Counts roots in a complete Vue slot before Suspense normalizes the array. */
function countVueSlotRoots(children: TemplateChildNode[]): number {
  return countSlotRoots(children, () => false);
}

/**
 * Counts roots in an implicit slot while treating named-slot templates as
 * barriers. Vue removes those templates from the default slot only after its
 * text transform has run, so text on opposite sides remains separate VNodes.
 */
function countImplicitSlotRoots(children: TemplateChildNode[]): number {
  return countSlotRoots(children, (child) => {
    if (child.type !== NodeTypes.ELEMENT || child.tag !== 'template') {
      return false;
    }
    return child.props.some(
      (property) =>
        property.type === NodeTypes.DIRECTIVE && property.name === 'slot'
    );
  });
}

function countSlotRoots(
  children: TemplateChildNode[],
  isExcluded: (child: TemplateChildNode) => boolean
): number {
  let roots = 0;
  let previousWasText = false;
  for (const child of children) {
    if (child.type === NodeTypes.COMMENT || isExcluded(child)) {
      previousWasText = false;
      continue;
    }
    const isText =
      child.type === NodeTypes.TEXT || child.type === NodeTypes.INTERPOLATION;
    if (!isText || !previousWasText) roots += 1;
    previousWasText = isText;
  }
  return roots;
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
  return resolveComponentBinding(
    element,
    bindings,
    bindings.components,
    bindings.registeredComponents,
    bindings.directBindings,
    expressionPlugins,
    shadowed
  );
}

/** Resolves a template tag or static dynamic selector through known bindings. */
function resolveComponentBinding<Name extends string>(
  element: ElementNode,
  bindings: TemplateBindings,
  directBindings: Map<string, Name>,
  registeredBindings: Map<string, Name>,
  directTemplateBindings: Set<string>,
  expressionPlugins: ParserPlugin[],
  shadowed: Set<string>
): { localName: string; originalName: Name } | undefined {
  if (element.tagType !== ElementTypes.COMPONENT) return undefined;
  const selector = readDynamicComponentSelector(
    element,
    expressionPlugins,
    bindings,
    shadowed
  );
  if (selector) {
    if (
      selector.unknown ||
      selector.possibleGT ||
      selector.componentFactories.size > 0 ||
      selector.gtComponentFactories.size > 0 ||
      selector.candidates.length === 0
    ) {
      return undefined;
    }
    const resolved = selector.candidates.map((candidate) => {
      for (const localName of normalizeTemplateBindingNames(candidate.name)) {
        const originalName =
          candidate.kind === 'string'
            ? registeredBindings.get(localName)
            : directBindings.get(localName);
        if (originalName) return { localName, originalName };
      }
      return undefined;
    });
    const first = resolved[0];
    return first &&
      resolved.every(
        (candidate) => candidate?.originalName === first.originalName
      )
      ? first
      : undefined;
  }
  for (const localName of normalizeTemplateBindingNames(element.tag)) {
    const originalName = isDirectTemplateBinding(
      localName,
      directTemplateBindings
    )
      ? directBindings.get(localName)
      : registeredBindings.get(localName);
    if (originalName) return { localName, originalName };
  }
  return undefined;
}

function normalizeTemplateBindingNames(sourceName: string): Set<string> {
  const camelized = sourceName.replace(/-(\w)/g, (_match, letter: string) =>
    letter.toUpperCase()
  );
  const pascalized = camelized
    ? camelized[0].toUpperCase() + camelized.slice(1)
    : camelized;
  return new Set([sourceName, camelized, pascalized]);
}

/** Returns whether a program binding shadows an Options API registration. */
function isDirectTemplateBinding(
  localName: string,
  directBindings: Set<string>
): boolean {
  return (
    directBindings.has(localName) ||
    directBindings.has(localName.split('.', 1)[0] ?? localName)
  );
}

/** Resolves a statically knowable Vue dynamic-component selector. */
function readDynamicComponentSelector(
  element: ElementNode,
  expressionPlugins: ParserPlugin[],
  bindings: TemplateBindings,
  shadowed: Set<string>
): DynamicSelectorAnalysis | undefined {
  if (element.tag.toLowerCase() !== 'component') return undefined;
  const property = element.props.find((candidate) =>
    isDynamicComponentSelector(element, candidate)
  );
  if (!property) return undefined;
  if (property.type === NodeTypes.ATTRIBUTE) {
    return property.value
      ? {
          candidates: [{ kind: 'string', name: property.value.content }],
          componentFactories: new Set(),
          containers: [],
          displayName: property.value.content,
          gtComponentFactories: new Set(),
          possibleGT: false,
          unknown: false,
        }
      : undefined;
  }
  const node = property.exp
    ? getExpressionNode(property.exp, expressionPlugins)
    : undefined;
  if (!node) return undefined;
  return {
    ...collectDynamicSelectorCandidates(node, bindings, shadowed, new Set()),
    displayName:
      property.exp?.type === NodeTypes.SIMPLE_EXPRESSION
        ? property.exp.content
        : 'dynamic component',
  };
}

/** Collects every statically visible result of a dynamic selector expression. */
function collectDynamicSelectorCandidates(
  node: babel.Node,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) {
    return emptyDynamicSelectorAnalysis(true);
  }
  const nextSeen = new Set(seen).add(expression);
  if (
    expression.type === 'ArrayExpression' ||
    expression.type === 'ObjectExpression'
  ) {
    return {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [{ kind: 'literal', node: expression }],
    };
  }
  if (
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'FunctionExpression' ||
    expression.type === 'ObjectMethod'
  ) {
    const result = collectTemplateCallableReturnAnalysis(
      expression,
      bindings,
      shadowed,
      nextSeen
    );
    return { ...result, unknown: true };
  }
  if (expression.type === 'Identifier') {
    if (shadowed.has(expression.name)) {
      return emptyDynamicSelectorAnalysis(true);
    }
    if (bindings.containerKinds.has(expression.name)) {
      return {
        ...emptyDynamicSelectorAnalysis(false),
        containers: [{ kind: 'path', path: expression.name }],
      };
    }
    if (bindings.staticValues.has(expression.name)) {
      const value = bindings.staticValues.get(expression.name);
      return typeof value === 'string'
        ? selectorCandidate('string', value)
        : emptyDynamicSelectorAnalysis(false);
    }
    const possibleStrings = bindings.possibleStaticStrings.get(expression.name);
    if (possibleStrings && possibleStrings.size > 0) {
      const result = mergeDynamicSelectorAnalyses(
        [...possibleStrings].map((value) => selectorCandidate('string', value))
      );
      return { ...result, unknown: true };
    }
    return selectorCandidate('expression', expression.name);
  }
  if (expression.type === 'StringLiteral') {
    return selectorCandidate('string', expression.value);
  }
  const staticValue = readTemplateStaticPrimitive(
    expression,
    bindings,
    shadowed
  );
  if (staticValue.ok) {
    return typeof staticValue.value === 'string'
      ? selectorCandidate('string', staticValue.value)
      : emptyDynamicSelectorAnalysis(false);
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const property = readStaticTemplateMemberProperty(
      expression,
      bindings,
      shadowed
    );
    if (property !== undefined) {
      const selected = selectTemplateStaticMemberExpression(
        expression.object,
        property,
        bindings,
        shadowed,
        new Set()
      );
      if (selected) {
        return collectDynamicSelectorCandidates(
          selected,
          bindings,
          shadowed,
          nextSeen
        );
      }
      const objectAnalysis = collectDynamicSelectorCandidates(
        expression.object,
        bindings,
        shadowed,
        nextSeen
      );
      if (objectAnalysis.containers.length > 0) {
        const memberAnalysis = mergeDynamicSelectorAnalyses(
          objectAnalysis.containers.map((container) =>
            selectTemplateContainerReference(
              container,
              property,
              bindings,
              shadowed,
              nextSeen
            )
          )
        );
        return {
          ...memberAnalysis,
          unknown: memberAnalysis.unknown || objectAnalysis.unknown,
        };
      }
    }
    const memberPath = readStaticTemplateMemberPath(
      expression,
      bindings,
      shadowed
    );
    if (memberPath) {
      const staticMember = bindings.staticValues.get(memberPath);
      if (typeof staticMember === 'string') {
        return selectorCandidate('string', staticMember);
      }
      if (bindings.containerKinds.has(memberPath)) {
        return {
          ...emptyDynamicSelectorAnalysis(false),
          containers: [{ kind: 'path', path: memberPath }],
        };
      }
      const possibleStrings = bindings.possibleStaticStrings.get(memberPath);
      if (possibleStrings && possibleStrings.size > 0) {
        const result = mergeDynamicSelectorAnalyses(
          [...possibleStrings].map((value) =>
            selectorCandidate('string', value)
          )
        );
        return { ...result, unknown: true };
      }
      const possibleContainer = findPossibleGTContainerPath(
        memberPath,
        bindings
      );
      if (possibleContainer) {
        return {
          ...emptyDynamicSelectorAnalysis(true),
          containers: [{ kind: 'path', path: possibleContainer }],
        };
      }
      if (templatePathSelectsPossibleGT(memberPath, bindings)) {
        return {
          ...emptyDynamicSelectorAnalysis(true),
          possibleGT: true,
        };
      }
      return selectorCandidate('expression', memberPath);
    }
    const container = collectTemplateContainerCandidates(
      expression.object,
      bindings,
      shadowed,
      nextSeen
    );
    if (
      container.candidates.length > 0 ||
      container.componentFactories.size > 0 ||
      container.containers.length > 0 ||
      container.gtComponentFactories.size > 0 ||
      container.possibleGT
    ) {
      return { ...container, unknown: true };
    }
    return emptyDynamicSelectorAnalysis(true);
  }
  if (expression.type === 'ConditionalExpression') {
    const test = readTemplateStaticPrimitive(
      expression.test,
      bindings,
      shadowed
    );
    if (test.ok) {
      return collectDynamicSelectorCandidates(
        test.value ? expression.consequent : expression.alternate,
        bindings,
        shadowed,
        nextSeen
      );
    }
    return mergeDynamicSelectorAnalyses([
      collectDynamicSelectorCandidates(
        expression.consequent,
        bindings,
        shadowed,
        nextSeen
      ),
      collectDynamicSelectorCandidates(
        expression.alternate,
        bindings,
        shadowed,
        nextSeen
      ),
    ]);
  }
  if (expression.type === 'LogicalExpression') {
    const leftCandidates = collectDynamicSelectorCandidates(
      expression.left,
      bindings,
      shadowed,
      nextSeen
    );
    if (selectorAnalysisIsKnownComponent(leftCandidates, bindings)) {
      return expression.operator === '&&'
        ? collectDynamicSelectorCandidates(
            expression.right,
            bindings,
            shadowed,
            nextSeen
          )
        : leftCandidates;
    }
    const left = readTemplateStaticPrimitive(
      expression.left,
      bindings,
      shadowed
    );
    if (left.ok) {
      const selectsRight =
        expression.operator === '??'
          ? left.value == null
          : expression.operator === '||'
            ? !left.value
            : Boolean(left.value);
      return selectsRight
        ? collectDynamicSelectorCandidates(
            expression.right,
            bindings,
            shadowed,
            nextSeen
          )
        : emptyDynamicSelectorAnalysis(false);
    }
    const merged = mergeDynamicSelectorAnalyses([
      leftCandidates,
      collectDynamicSelectorCandidates(
        expression.right,
        bindings,
        shadowed,
        nextSeen
      ),
    ]);
    return { ...merged, unknown: true };
  }
  if (expression.type === 'SequenceExpression') {
    const last = expression.expressions.at(-1);
    return last
      ? collectDynamicSelectorCandidates(last, bindings, shadowed, nextSeen)
      : emptyDynamicSelectorAnalysis(true);
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const reduction = collectTemplateReductionResult(
      expression,
      bindings,
      shadowed,
      nextSeen
    );
    if (reduction) return reduction;
    const directCallable = unwrapExpression(expression.callee);
    if (
      directCallable &&
      (directCallable.type === 'ArrowFunctionExpression' ||
        directCallable.type === 'FunctionExpression')
    ) {
      const returned = collectTemplateCallableReturnAnalysis(
        directCallable,
        bindings,
        shadowed,
        nextSeen
      );
      return { ...returned, unknown: true };
    }
    const memberCallee = unwrapExpression(expression.callee);
    if (
      memberCallee &&
      (memberCallee.type === 'MemberExpression' ||
        memberCallee.type === 'OptionalMemberExpression')
    ) {
      const method = readStaticTemplateMemberProperty(
        memberCallee,
        bindings,
        shadowed
      );
      const literalMethod = method
        ? selectTemplateStaticMemberExpression(
            memberCallee.object,
            method,
            bindings,
            shadowed,
            new Set()
          )
        : undefined;
      if (literalMethod?.type === 'ObjectMethod') {
        const returned = collectTemplateCallableReturnAnalysis(
          literalMethod,
          bindings,
          shadowed,
          nextSeen
        );
        return { ...returned, unknown: true };
      }
      if (method === 'call' || method === 'apply' || method === 'bind') {
        const receiver = collectDynamicSelectorCandidates(
          memberCallee.object,
          bindings,
          shadowed,
          nextSeen
        );
        const receiverPath = readStaticTemplateMemberPath(
          memberCallee.object,
          bindings,
          shadowed
        );
        if (receiverPath && bindings.componentFactories.has(receiverPath)) {
          receiver.componentFactories.add(receiverPath);
        }
        if (receiverPath && bindings.gtComponentFactories.has(receiverPath)) {
          receiver.gtComponentFactories.add(receiverPath);
        }
        if (
          receiver.componentFactories.size > 0 ||
          receiver.gtComponentFactories.size > 0
        ) {
          return { ...receiver, unknown: true };
        }
      }
      if (
        method &&
        (COMPONENT_SELECTING_ARRAY_METHODS.has(method) ||
          COMPONENT_PRESERVING_ARRAY_METHODS.has(method))
      ) {
        const references = collectTemplateContainerReferences(
          memberCallee.object,
          bindings,
          shadowed,
          nextSeen
        );
        const arrays = references.containers.filter(
          (container) =>
            isKnownTemplateArray(container, bindings) &&
            !templateContainerHasOwnMember(container, method, bindings)
        );
        if (arrays.length > 0) {
          if (COMPONENT_PRESERVING_ARRAY_METHODS.has(method)) {
            const argumentAnalyses =
              method === 'concat'
                ? expression.arguments.flatMap((argument) =>
                    argument.type === 'ArgumentPlaceholder'
                      ? []
                      : [
                          collectDynamicSelectorCandidates(
                            argument.type === 'SpreadElement'
                              ? argument.argument
                              : argument,
                            bindings,
                            shadowed,
                            nextSeen
                          ),
                        ]
                  )
                : [];
            const argumentContainers =
              method === 'concat'
                ? argumentAnalyses.flatMap((analysis) => analysis.containers)
                : [];
            return {
              ...emptyDynamicSelectorAnalysis(true),
              containers: [...arrays, ...argumentContainers],
              possibleGT: argumentAnalyses.some((analysis) =>
                selectorAnalysisMayContainGT(analysis, bindings)
              ),
            };
          }

          let hasUnknownSelection = false;
          const analyses = arrays.flatMap((container) => {
            const key = readSelectingArrayMethodKey(
              method,
              expression.arguments[0],
              container,
              bindings,
              shadowed
            );
            if (key === null) return [];
            hasUnknownSelection ||= key === undefined;
            return [
              selectTemplateContainerReference(
                container,
                key,
                bindings,
                shadowed,
                nextSeen
              ),
            ];
          });
          if (analyses.length === 0) {
            return emptyDynamicSelectorAnalysis(false);
          }
          const selected = mergeDynamicSelectorAnalyses(analyses);
          return {
            ...selected,
            unknown: selected.unknown || hasUnknownSelection,
          };
        }
      }
      if (method === 'get') {
        const receiverPath = readStaticTemplateMemberPath(
          memberCallee.object,
          bindings,
          shadowed
        );
        if (
          receiverPath &&
          findPossibleGTContainerPath(receiverPath, bindings)
        ) {
          return {
            ...emptyDynamicSelectorAnalysis(true),
            possibleGT: true,
          };
        }
        const references = collectTemplateContainerReferences(
          memberCallee.object,
          bindings,
          shadowed,
          nextSeen
        );
        if (references.containers.length > 0) {
          const argument = expression.arguments[0];
          const staticKey =
            argument &&
            argument.type !== 'ArgumentPlaceholder' &&
            argument.type !== 'SpreadElement'
              ? readTemplateStaticPrimitive(argument, bindings, shadowed)
              : undefined;
          const key =
            staticKey?.ok &&
            (typeof staticKey.value === 'string' ||
              typeof staticKey.value === 'number')
              ? String(staticKey.value)
              : argument &&
                  argument.type !== 'ArgumentPlaceholder' &&
                  argument.type !== 'SpreadElement'
                ? (() => {
                    const argumentPath = readStaticTemplateMemberPath(
                      argument,
                      bindings,
                      shadowed
                    );
                    return argumentPath &&
                      bindings.containerKinds.has(argumentPath)
                      ? argumentPath
                      : undefined;
                  })()
                : undefined;
          const selected = mergeDynamicSelectorAnalyses(
            references.containers.map((container) =>
              selectTemplateContainerReference(
                container,
                key,
                bindings,
                shadowed,
                nextSeen
              )
            )
          );
          return {
            ...selected,
            unknown: selected.unknown || key === undefined,
          };
        }
      }
    }
    const callee = readStaticTemplateMemberPath(
      expression.callee,
      bindings,
      shadowed
    );
    if (callee === 'Reflect.get' && expression.arguments.length >= 2) {
      const target = expression.arguments[0];
      const keyNode = expression.arguments[1];
      if (
        target &&
        target.type !== 'ArgumentPlaceholder' &&
        target.type !== 'SpreadElement' &&
        keyNode &&
        keyNode.type !== 'ArgumentPlaceholder' &&
        keyNode.type !== 'SpreadElement'
      ) {
        const references = collectTemplateContainerReferences(
          target,
          bindings,
          shadowed,
          nextSeen
        );
        const staticKey = readTemplateStaticPrimitive(
          keyNode,
          bindings,
          shadowed
        );
        const key =
          staticKey.ok &&
          (typeof staticKey.value === 'string' ||
            typeof staticKey.value === 'number')
            ? String(staticKey.value)
            : undefined;
        const selected = mergeDynamicSelectorAnalyses(
          references.containers.map((container) =>
            selectTemplateContainerReference(
              container,
              key,
              bindings,
              shadowed,
              nextSeen
            )
          )
        );
        if (references.containers.length > 0) {
          return {
            ...selected,
            unknown: selected.unknown || key === undefined,
          };
        }
      }
    }
    const first = expression.arguments[0];
    if (
      callee &&
      bindings.identityFunctions.has(callee) &&
      expression.arguments.length === 1 &&
      first &&
      first.type !== 'ArgumentPlaceholder' &&
      first.type !== 'SpreadElement'
    ) {
      return collectDynamicSelectorCandidates(
        first,
        bindings,
        shadowed,
        nextSeen
      );
    }
    const argumentsAnalysis = mergeDynamicSelectorAnalyses(
      expression.arguments
        .filter(
          (
            argument
          ): argument is Exclude<typeof argument, babel.ArgumentPlaceholder> =>
            argument.type !== 'ArgumentPlaceholder'
        )
        .map((argument) =>
          collectDynamicSelectorCandidates(
            argument.type === 'SpreadElement' ? argument.argument : argument,
            bindings,
            shadowed,
            nextSeen
          )
        )
    );
    const calleeAnalysis = collectDynamicSelectorCandidates(
      expression.callee,
      bindings,
      shadowed,
      nextSeen
    );
    for (const candidate of calleeAnalysis.candidates) {
      if (candidate.kind !== 'expression') continue;
      if (bindings.componentFactories.has(candidate.name)) {
        argumentsAnalysis.componentFactories.add(candidate.name);
      }
      if (bindings.gtComponentFactories.has(candidate.name)) {
        argumentsAnalysis.gtComponentFactories.add(candidate.name);
      }
    }
    for (const name of calleeAnalysis.componentFactories) {
      argumentsAnalysis.componentFactories.add(name);
    }
    for (const name of calleeAnalysis.gtComponentFactories) {
      argumentsAnalysis.gtComponentFactories.add(name);
    }
    if (callee && bindings.componentFactories.has(callee)) {
      argumentsAnalysis.componentFactories.add(callee);
    }
    if (callee && bindings.gtComponentFactories.has(callee)) {
      argumentsAnalysis.gtComponentFactories.add(callee);
    }
    return { ...argumentsAnalysis, unknown: true };
  }
  if (expression.type === 'AssignmentExpression') {
    return collectDynamicSelectorCandidates(
      expression.right,
      bindings,
      shadowed,
      nextSeen
    );
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return expression.argument
      ? collectDynamicSelectorCandidates(
          expression.argument,
          bindings,
          shadowed,
          nextSeen
        )
      : emptyDynamicSelectorAnalysis(true);
  }
  return emptyDynamicSelectorAnalysis(false);
}

/** Finds component-bearing values that a dynamic container index may select. */
function collectTemplateContainerCandidates(
  node: babel.Node,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) {
    return emptyDynamicSelectorAnalysis(true);
  }
  const nextSeen = new Set(seen).add(expression);
  if (
    expression.type === 'ArrayExpression' ||
    expression.type === 'ObjectExpression'
  ) {
    return collectLiteralContainerCandidates(
      expression,
      bindings,
      shadowed,
      nextSeen
    );
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const transformed = collectTemplateTransformCandidates(
      expression,
      bindings,
      shadowed,
      nextSeen
    );
    if (transformed) return transformed;
  }
  const path = readStaticTemplateMemberPath(expression, bindings, shadowed);
  if (
    path &&
    (bindings.containerKinds.has(path) ||
      findPossibleGTContainerPath(path, bindings) !== undefined ||
      hasImmediatePossibleGTContainerChild(path, bindings) ||
      hasPossibleStaticStringChild(path, bindings))
  ) {
    const result =
      bindings.containerKinds.has(path) ||
      hasImmediatePossibleGTContainerChild(path, bindings) ||
      hasPossibleStaticStringChild(path, bindings)
        ? collectExposedContainerCandidates(path, bindings)
        : emptyDynamicSelectorAnalysis(true);
    return {
      ...result,
      possibleGT:
        result.possibleGT ||
        findPossibleGTContainerPath(path, bindings) !== undefined,
    };
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const callee = readStaticTemplateMemberPath(
      expression.callee,
      bindings,
      shadowed
    );
    if (callee && bindings.gtContainerFactories.has(callee)) {
      return {
        ...emptyDynamicSelectorAnalysis(true),
        possibleGT: true,
      };
    }
  }
  const selected = collectDynamicSelectorCandidates(
    expression,
    bindings,
    shadowed,
    seen
  );
  const analyses = selected.containers.map((container) =>
    selectTemplateContainerReference(
      container,
      undefined,
      bindings,
      shadowed,
      nextSeen
    )
  );
  if (analyses.length === 0) {
    return {
      ...emptyDynamicSelectorAnalysis(true),
      possibleGT: false,
    };
  }
  const result = mergeDynamicSelectorAnalyses(analyses);
  return {
    ...result,
    possibleGT: result.possibleGT,
    unknown: result.unknown || selected.unknown,
  };
}

/** Models built-in transforms whose result is immediately selected or iterated. */
function collectTemplateTransformCandidates(
  call: babel.CallExpression | babel.OptionalCallExpression,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> | undefined {
  const callee = unwrapExpression(call.callee);
  if (
    !callee ||
    (callee.type !== 'MemberExpression' &&
      callee.type !== 'OptionalMemberExpression')
  ) {
    return undefined;
  }
  const method = readStaticTemplateMemberProperty(callee, bindings, shadowed);
  if (!method) return undefined;
  const receiverPath = readStaticTemplateMemberPath(
    callee.object,
    bindings,
    shadowed
  );
  const readArgument = (index: number): babel.Node | undefined => {
    const argument = call.arguments[index];
    return argument && argument.type !== 'ArgumentPlaceholder'
      ? argument.type === 'SpreadElement'
        ? argument.argument
        : argument
      : undefined;
  };
  const receiver = (): Omit<DynamicSelectorAnalysis, 'displayName'> =>
    collectTemplateContainerCandidates(callee.object, bindings, shadowed, seen);
  const mapValues = (
    source: Omit<DynamicSelectorAnalysis, 'displayName'>,
    callbackNode: babel.Node | undefined,
    includeSourceParameter = true,
    thisNode?: babel.Node
  ): Omit<DynamicSelectorAnalysis, 'displayName'> => {
    const callback = unwrapExpression(callbackNode);
    if (
      !callback ||
      (callback.type !== 'ArrowFunctionExpression' &&
        callback.type !== 'FunctionExpression')
    ) {
      return { ...source, unknown: true };
    }
    const parameters = new Map<
      string,
      Omit<DynamicSelectorAnalysis, 'displayName'>
    >();
    const sourceArray: Omit<DynamicSelectorAnalysis, 'displayName'> = {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [
        { kind: 'analysis', containerKind: 'array', values: source },
      ],
    };
    const callbackArguments = [
      source,
      emptyDynamicSelectorAnalysis(false),
      ...(includeSourceParameter ? [sourceArray] : []),
    ];
    bindTemplateCallbackParameters(
      callback,
      callbackArguments,
      bindings,
      shadowed,
      parameters
    );
    if (callback.type !== 'ArrowFunctionExpression' && thisNode) {
      parameters.set(
        'this',
        collectTemplateSelectorValue(thisNode, bindings, shadowed, seen)
      );
    }
    const analyses = collectTemplateFunctionReturns(callback).map((value) =>
      collectTemplateCallbackReturnValue(
        value,
        parameters,
        bindings,
        shadowed,
        seen
      )
    );
    const mapped = mergeDynamicSelectorAnalyses(analyses);
    return { ...mapped, unknown: mapped.unknown || analyses.length === 0 };
  };

  if (
    receiverPath === 'Array' &&
    method === 'from' &&
    !bindings.directBindings.has('Array') &&
    !shadowed.has('Array')
  ) {
    const sourceNode = readArgument(0);
    if (!sourceNode) return emptyDynamicSelectorAnalysis(true);
    const source = collectTemplateContainerCandidates(
      sourceNode,
      bindings,
      shadowed,
      seen
    );
    return call.arguments.length > 1
      ? mapValues(source, readArgument(1), false, readArgument(2))
      : source;
  }

  if (
    receiverPath === 'Object' &&
    (method === 'values' || method === 'entries') &&
    !bindings.directBindings.has('Object') &&
    !shadowed.has('Object')
  ) {
    const sourceNode = readArgument(0);
    if (!sourceNode) return emptyDynamicSelectorAnalysis(true);
    if (method === 'values') {
      return collectTemplateContainerCandidates(
        sourceNode,
        bindings,
        shadowed,
        seen
      );
    }
    const sourceValues = collectTemplateContainerCandidates(
      sourceNode,
      bindings,
      shadowed,
      seen
    );
    const source = unwrapExpression(sourceNode);
    if (source?.type !== 'ObjectExpression') {
      return {
        ...emptyDynamicSelectorAnalysis(false),
        containers: [
          {
            kind: 'analysis',
            containerKind: 'array',
            members: new Map([
              ['0', emptyDynamicSelectorAnalysis(false)],
              ['1', sourceValues],
            ]),
            values: sourceValues,
          },
        ],
      };
    }
    const properties = flattenTemplateLiteralObject(source, new Set());
    if (!properties) return emptyDynamicSelectorAnalysis(true);
    const tuples: DynamicSelectorContainer[] = [];
    let unknown = false;
    for (const property of properties) {
      if (property.type === 'SpreadElement') {
        unknown = true;
        continue;
      }
      const key = readTemplateLiteralPropertyKey(property, bindings, shadowed);
      if (
        property.type !== 'ObjectProperty' ||
        !babel.isExpression(property.value)
      ) {
        unknown = true;
        continue;
      }
      tuples.push({
        kind: 'literal',
        node: babel.arrayExpression([
          babel.stringLiteral(key ?? ''),
          property.value,
        ]),
      });
      unknown ||= key === undefined;
    }
    return {
      ...emptyDynamicSelectorAnalysis(unknown),
      containers: tuples,
    };
  }

  const source = receiver();
  if (method === 'concat') {
    const argumentsAnalysis = call.arguments.flatMap((_, index) => {
      const argument = readArgument(index);
      if (!argument) return [];
      return [
        flattenTemplateTransformAnalysis(
          collectDynamicSelectorCandidates(argument, bindings, shadowed, seen),
          1,
          bindings,
          shadowed,
          seen
        ),
      ];
    });
    return mergeDynamicSelectorAnalyses([source, ...argumentsAnalysis]);
  }
  if (method === 'map') {
    return mapValues(source, readArgument(0), true, readArgument(1));
  }
  if (method === 'flatMap') {
    return flattenTemplateTransformAnalysis(
      mapValues(source, readArgument(0), true, readArgument(1)),
      1,
      bindings,
      shadowed,
      seen
    );
  }
  if (method === 'flat') {
    const depthNode = readArgument(0);
    const depthValue = depthNode
      ? readTemplateStaticPrimitive(depthNode, bindings, shadowed, true)
      : { ok: true as const, value: 1 };
    if (!depthValue.ok) {
      const possibilities = [source];
      let current = source;
      for (
        let depth = 0;
        depth < 32 && current.containers.length > 0;
        depth += 1
      ) {
        current = flattenTemplateTransformAnalysis(
          current,
          1,
          bindings,
          shadowed,
          seen
        );
        possibilities.push(current);
      }
      const merged = mergeDynamicSelectorAnalyses(possibilities);
      return { ...merged, unknown: true };
    }
    if (typeof depthValue.value === 'bigint') {
      return emptyDynamicSelectorAnalysis(false);
    }
    const numericDepth = Number(depthValue.value);
    const depth = Number.isNaN(numericDepth)
      ? 0
      : numericDepth === Number.POSITIVE_INFINITY
        ? 32
        : Math.max(0, Math.trunc(numericDepth));
    return flattenTemplateTransformAnalysis(
      source,
      depth,
      bindings,
      shadowed,
      seen
    );
  }
  if (method === 'with' || method === 'toSpliced') {
    const inserted =
      method === 'with'
        ? [readArgument(1)]
        : call.arguments.slice(2).map((_, index) => readArgument(index + 2));
    return mergeDynamicSelectorAnalyses([
      source,
      ...inserted.flatMap((value) =>
        value
          ? [collectTemplateSelectorValue(value, bindings, shadowed, seen)]
          : []
      ),
    ]);
  }
  if (method === 'copyWithin') return source;
  if (method === 'fill') {
    const value = readArgument(0);
    return value
      ? collectTemplateSelectorValue(value, bindings, shadowed, seen)
      : emptyDynamicSelectorAnalysis(false);
  }
  if (method === 'reduce' || method === 'reduceRight') {
    const reduction = collectTemplateReductionResult(
      call,
      bindings,
      shadowed,
      seen
    );
    if (reduction) {
      const scalar = { ...reduction, containers: [] };
      return mergeDynamicSelectorAnalyses([
        scalar,
        ...reduction.containers.map((container) =>
          selectTemplateContainerReference(
            container,
            undefined,
            bindings,
            shadowed,
            seen
          )
        ),
      ]);
    }
    const flattened = flattenTemplateTransformAnalysis(
      source,
      1,
      bindings,
      shadowed,
      seen
    );
    const initial = readArgument(1);
    return mergeDynamicSelectorAnalyses([
      source,
      flattened,
      ...(initial
        ? [collectTemplateSelectorValue(initial, bindings, shadowed, seen)]
        : []),
    ]);
  }
  return undefined;
}

/** Evaluates a finite literal reduce/reduceRight without executing user code. */
function collectTemplateReductionResult(
  call: babel.CallExpression | babel.OptionalCallExpression,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> | undefined {
  const callee = unwrapExpression(call.callee);
  if (
    !callee ||
    (callee.type !== 'MemberExpression' &&
      callee.type !== 'OptionalMemberExpression')
  ) {
    return undefined;
  }
  const method = readStaticTemplateMemberProperty(callee, bindings, shadowed);
  if (method !== 'reduce' && method !== 'reduceRight') return undefined;
  const receiver = unwrapExpression(callee.object);
  if (receiver?.type !== 'ArrayExpression') return undefined;
  const elements = flattenTemplateLiteralArray(receiver, new Set());
  if (!elements) return undefined;
  const callbackArgument = call.arguments[0];
  const callback =
    callbackArgument &&
    callbackArgument.type !== 'ArgumentPlaceholder' &&
    callbackArgument.type !== 'SpreadElement'
      ? unwrapExpression(callbackArgument)
      : undefined;
  if (
    !callback ||
    (callback.type !== 'ArrowFunctionExpression' &&
      callback.type !== 'FunctionExpression')
  ) {
    return undefined;
  }
  const entries = elements
    .filter((element): element is babel.Node => Boolean(element))
    .map((element) =>
      collectTemplateSelectorValue(element, bindings, shadowed, seen)
    );
  const initialArgument = call.arguments[1];
  const initial =
    initialArgument &&
    initialArgument.type !== 'ArgumentPlaceholder' &&
    initialArgument.type !== 'SpreadElement'
      ? collectTemplateSelectorValue(initialArgument, bindings, shadowed, seen)
      : undefined;
  if (entries.length === 0)
    return initial ?? emptyDynamicSelectorAnalysis(false);
  const ordered = method === 'reduceRight' ? [...entries].reverse() : entries;
  let accumulator = initial ?? ordered.shift();
  if (!accumulator) return emptyDynamicSelectorAnalysis(false);
  const sourceArray = collectTemplateSelectorValue(
    receiver,
    bindings,
    shadowed,
    seen
  );
  for (const current of ordered) {
    const parameters = new Map<
      string,
      Omit<DynamicSelectorAnalysis, 'displayName'>
    >();
    bindTemplateCallbackParameters(
      callback,
      [accumulator, current, emptyDynamicSelectorAnalysis(false), sourceArray],
      bindings,
      shadowed,
      parameters
    );
    const returned = collectTemplateFunctionReturns(callback).map((value) =>
      collectTemplateCallbackReturnValue(
        value,
        parameters,
        bindings,
        shadowed,
        seen
      )
    );
    accumulator =
      returned.length > 0
        ? mergeDynamicSelectorAnalyses(returned)
        : emptyDynamicSelectorAnalysis(true);
  }
  return accumulator;
}

/** Flattens only container alternatives while retaining non-array values. */
function flattenTemplateTransformAnalysis(
  analysis: Omit<DynamicSelectorAnalysis, 'displayName'>,
  depth: number,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  let current = analysis;
  for (
    let index = 0;
    index < depth && current.containers.length > 0;
    index += 1
  ) {
    const retained = { ...current, containers: [] };
    const children = current.containers.map((container) =>
      selectTemplateContainerReference(
        container,
        undefined,
        bindings,
        shadowed,
        seen
      )
    );
    current = mergeDynamicSelectorAnalyses([retained, ...children]);
  }
  return current;
}

/** Binds positional callback values, including a precise rest-argument tuple. */
function bindTemplateCallbackParameters(
  callback: babel.ArrowFunctionExpression | babel.FunctionExpression,
  callbackArguments: Array<Omit<DynamicSelectorAnalysis, 'displayName'>>,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  parameters: Map<string, Omit<DynamicSelectorAnalysis, 'displayName'>>
): void {
  callback.params.forEach((parameter, index) => {
    if (!isTemplateBindingPattern(parameter)) return;
    if (parameter.type === 'RestElement') {
      if (!isTemplateBindingPattern(parameter.argument)) return;
      const restValues = callbackArguments.slice(index);
      collectTemplateCallbackParameterValues(
        parameter.argument,
        {
          ...emptyDynamicSelectorAnalysis(false),
          containers: [
            {
              kind: 'analysis',
              containerKind: 'array',
              members: new Map(
                restValues.map((value, memberIndex) => [
                  String(memberIndex),
                  value,
                ])
              ),
              values: mergeDynamicSelectorAnalyses(restValues),
            },
          ],
        },
        bindings,
        shadowed,
        parameters
      );
      return;
    }
    collectTemplateCallbackParameterValues(
      parameter,
      callbackArguments[index] ?? emptyDynamicSelectorAnalysis(true),
      bindings,
      shadowed,
      parameters
    );
  });
}

/** Projects one mapper input through its callback parameter pattern. */
function collectTemplateCallbackParameterValues(
  pattern: TemplateBindingPattern,
  values: Omit<DynamicSelectorAnalysis, 'displayName'>,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  parameters: Map<string, Omit<DynamicSelectorAnalysis, 'displayName'>>
): void {
  if (pattern.type === 'Identifier') {
    parameters.set(pattern.name, values);
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    if (isTemplateBindingPattern(pattern.left)) {
      collectTemplateCallbackParameterValues(
        pattern.left,
        mergeDynamicSelectorAnalyses([
          values,
          collectDynamicSelectorCandidates(
            pattern.right,
            bindings,
            shadowed,
            new Set()
          ),
        ]),
        bindings,
        shadowed,
        parameters
      );
    }
    return;
  }
  if (pattern.type === 'RestElement') {
    if (isTemplateBindingPattern(pattern.argument)) {
      collectTemplateCallbackParameterValues(
        pattern.argument,
        {
          ...emptyDynamicSelectorAnalysis(false),
          containers: [{ kind: 'analysis', containerKind: 'array', values }],
        },
        bindings,
        shadowed,
        parameters
      );
    }
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      const target =
        property.type === 'RestElement' ? property.argument : property.value;
      if (!isTemplateBindingPattern(target)) continue;
      collectTemplateCallbackParameterValues(
        target,
        property.type === 'RestElement'
          ? values
          : selectPossibleContainerChildren(
              values,
              readTemplateLiteralPropertyKey(property, bindings, shadowed),
              bindings,
              shadowed
            ),
        bindings,
        shadowed,
        parameters
      );
    }
    return;
  }
  pattern.elements.forEach((element, index) => {
    if (!element || !isTemplateBindingPattern(element)) return;
    collectTemplateCallbackParameterValues(
      element,
      selectPossibleContainerChildren(
        values,
        element.type === 'RestElement' ? undefined : String(index),
        bindings,
        shadowed
      ),
      bindings,
      shadowed,
      parameters
    );
  });
}

/** Evaluates a callback return against abstract parameter values. */
function collectTemplateCallbackReturnValue(
  node: babel.Node,
  parameters: Map<string, Omit<DynamicSelectorAnalysis, 'displayName'>>,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const expression = unwrapExpression(node);
  if (!expression) return emptyDynamicSelectorAnalysis(true);
  if (expression.type === 'Identifier') {
    const parameter = parameters.get(expression.name);
    if (parameter) return parameter;
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const callee = unwrapExpression(expression.callee);
    if (
      callee &&
      (callee.type === 'MemberExpression' ||
        callee.type === 'OptionalMemberExpression') &&
      readStaticTemplateMemberProperty(callee, bindings, shadowed) === 'concat'
    ) {
      const objectValue = collectTemplateCallbackReturnValue(
        callee.object,
        parameters,
        bindings,
        shadowed,
        seen
      );
      if (objectValue.containers.length > 0) {
        const flattenOne = (
          value: Omit<DynamicSelectorAnalysis, 'displayName'>
        ): Omit<DynamicSelectorAnalysis, 'displayName'> =>
          mergeDynamicSelectorAnalyses([
            { ...value, containers: [] },
            ...value.containers.map((container) =>
              selectTemplateContainerReference(
                container,
                undefined,
                bindings,
                shadowed,
                seen
              )
            ),
          ]);
        const values = mergeDynamicSelectorAnalyses([
          flattenOne(objectValue),
          ...expression.arguments.flatMap((argument) =>
            argument.type === 'ArgumentPlaceholder'
              ? []
              : [
                  flattenOne(
                    collectTemplateCallbackReturnValue(
                      argument.type === 'SpreadElement'
                        ? argument.argument
                        : argument,
                      parameters,
                      bindings,
                      shadowed,
                      seen
                    )
                  ),
                ]
          ),
        ]);
        return {
          ...emptyDynamicSelectorAnalysis(false),
          containers: [{ kind: 'analysis', containerKind: 'array', values }],
        };
      }
    }
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const objectValue = collectTemplateCallbackReturnValue(
      expression.object,
      parameters,
      bindings,
      shadowed,
      seen
    );
    if (objectValue.containers.length > 0) {
      return selectPossibleContainerChildren(
        objectValue,
        readStaticTemplateMemberProperty(expression, bindings, shadowed),
        bindings,
        shadowed
      );
    }
  }
  if (expression.type === 'ThisExpression') {
    return parameters.get('this') ?? emptyDynamicSelectorAnalysis(true);
  }
  if (expression.type === 'ArrayExpression') {
    const elementValues = expression.elements.map((element) =>
      element
        ? collectTemplateCallbackReturnValue(
            element.type === 'SpreadElement' ? element.argument : element,
            parameters,
            bindings,
            shadowed,
            seen
          )
        : emptyDynamicSelectorAnalysis(false)
    );
    const values = mergeDynamicSelectorAnalyses(elementValues);
    const hasSpread = expression.elements.some(
      (element) => element?.type === 'SpreadElement'
    );
    return {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [
        {
          kind: 'analysis',
          containerKind: 'array',
          members: hasSpread
            ? undefined
            : new Map(
                elementValues.map((value, index) => [String(index), value])
              ),
          values,
        },
      ],
    };
  }
  if (expression.type === 'ObjectExpression') {
    const values = mergeDynamicSelectorAnalyses(
      expression.properties.map((property) =>
        collectTemplateCallbackReturnValue(
          property.type === 'SpreadElement'
            ? property.argument
            : property.type === 'ObjectProperty'
              ? property.value
              : property,
          parameters,
          bindings,
          shadowed,
          seen
        )
      )
    );
    return {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [{ kind: 'analysis', containerKind: 'object', values }],
    };
  }
  if (expression.type === 'ConditionalExpression') {
    return mergeDynamicSelectorAnalyses([
      collectTemplateCallbackReturnValue(
        expression.consequent,
        parameters,
        bindings,
        shadowed,
        seen
      ),
      collectTemplateCallbackReturnValue(
        expression.alternate,
        parameters,
        bindings,
        shadowed,
        seen
      ),
    ]);
  }
  if (expression.type === 'LogicalExpression') {
    return mergeDynamicSelectorAnalyses([
      collectTemplateCallbackReturnValue(
        expression.left,
        parameters,
        bindings,
        shadowed,
        seen
      ),
      collectTemplateCallbackReturnValue(
        expression.right,
        parameters,
        bindings,
        shadowed,
        seen
      ),
    ]);
  }
  if (expression.type === 'SequenceExpression') {
    const last = expression.expressions.at(-1);
    return last
      ? collectTemplateCallbackReturnValue(
          last,
          parameters,
          bindings,
          shadowed,
          seen
        )
      : emptyDynamicSelectorAnalysis(true);
  }
  return collectTemplateSelectorValue(expression, bindings, shadowed, seen);
}

/** Resolves an expression to container identities without selecting a child. */
function collectTemplateContainerReferences(
  node: babel.Node,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) {
    return emptyDynamicSelectorAnalysis(true);
  }
  if (
    expression.type === 'ArrayExpression' ||
    expression.type === 'ObjectExpression'
  ) {
    return {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [{ kind: 'literal', node: expression }],
    };
  }
  const path = readStaticTemplateMemberPath(expression, bindings, shadowed);
  if (path && bindings.containerKinds.has(path)) {
    return {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [{ kind: 'path', path }],
    };
  }
  const selected = collectDynamicSelectorCandidates(
    expression,
    bindings,
    shadowed,
    seen
  );
  return {
    ...emptyDynamicSelectorAnalysis(selected.unknown),
    containers: selected.containers,
  };
}

/** Selects one exact child, or every immediate child, from a container. */
function selectTemplateContainerReference(
  container: DynamicSelectorContainer,
  key: string | undefined,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  if (container.kind === 'path') {
    return key === undefined
      ? collectExposedContainerCandidates(container.path, bindings)
      : collectExposedPathCandidate(
          appendTemplatePath(container.path, key),
          bindings
        );
  }
  if (container.kind === 'analysis') {
    const selected =
      key === undefined ? container.values : container.members?.get(key);
    return selected
      ? { ...selected, unknown: selected.unknown || key === undefined }
      : emptyDynamicSelectorAnalysis(true);
  }
  if (key === undefined) {
    return collectLiteralContainerCandidates(
      container.node,
      bindings,
      shadowed,
      seen
    );
  }
  const selected = selectTemplateLiteralMember(container.node, key);
  return selected
    ? collectTemplateSelectorValue(selected, bindings, shadowed, seen)
    : templateLiteralMemberIsUncertain(container.node, key)
      ? collectLiteralContainerCandidates(
          container.node,
          bindings,
          shadowed,
          seen
        )
      : emptyDynamicSelectorAnalysis(false);
}

/** Reads one exact flattened script path, retaining its value category. */
function collectExposedPathCandidate(
  path: string,
  bindings: TemplateBindings
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const result = emptyDynamicSelectorAnalysis(false);
  const value = bindings.staticValues.get(path);
  if (typeof value === 'string') {
    result.candidates.push({ kind: 'string', name: value });
  }
  const possibleStrings = bindings.possibleStaticStrings.get(path);
  if (possibleStrings) {
    for (const possible of possibleStrings) {
      result.candidates.push({ kind: 'string', name: possible });
    }
    result.unknown = possibleStrings.size > 0;
  }
  if (
    bindings.components.has(path) ||
    bindings.vueBuiltins.has(path) ||
    bindings.uncertainComponents.has(path)
  ) {
    result.candidates.push({ kind: 'expression', name: path });
  }
  if (bindings.componentFactories.has(path)) {
    result.componentFactories.add(path);
    result.candidates.push({ kind: 'expression', name: path });
  }
  if (bindings.gtComponentFactories.has(path)) {
    result.gtComponentFactories.add(path);
  }
  if (bindings.containerKinds.has(path)) {
    result.containers.push({ kind: 'path', path });
  }
  const possibleContainer = findPossibleGTContainerPath(path, bindings);
  if (possibleContainer) {
    result.containers.push({ kind: 'path', path: possibleContainer });
  }
  result.possibleGT ||= templatePathSelectsPossibleGT(path, bindings);
  result.unknown =
    result.unknown ||
    bindings.uncertainComponents.has(path) ||
    (result.candidates.length === 0 &&
      result.componentFactories.size === 0 &&
      result.containers.length === 0);
  return result;
}

/** Returns true only for arrays whose shape was proven by static analysis. */
function isKnownTemplateArray(
  container: DynamicSelectorContainer,
  bindings: TemplateBindings
): boolean {
  return container.kind === 'literal'
    ? container.node.type === 'ArrayExpression'
    : container.kind === 'analysis'
      ? container.containerKind === 'array'
      : bindings.containerKinds.get(container.path) === 'array';
}

/** Detects a statically defined own property that overrides an array method. */
function templateContainerHasOwnMember(
  container: DynamicSelectorContainer,
  member: string,
  bindings: TemplateBindings
): boolean {
  if (container.kind !== 'path') return false;
  const path = appendTemplatePath(container.path, member);
  return (
    bindings.components.has(path) ||
    bindings.componentFactories.has(path) ||
    bindings.containerKinds.has(path) ||
    bindings.gtComponentFactories.has(path) ||
    bindings.staticValues.has(path) ||
    bindings.uncertainComponents.has(path) ||
    bindings.vueBuiltins.has(path)
  );
}

/** Resolves the exact child selected by an array method when it is static. */
function readSelectingArrayMethodKey(
  method: string,
  argument: babel.CallExpression['arguments'][number] | undefined,
  container: DynamicSelectorContainer,
  bindings: TemplateBindings,
  shadowed: Set<string>
): string | null | undefined {
  if (templateContainerHasOwnMember(container, method, bindings)) {
    return null;
  }
  const length =
    container.kind === 'literal'
      ? container.node.type === 'ArrayExpression'
        ? flattenTemplateLiteralArray(container.node, new Set())?.length
        : undefined
      : container.kind === 'path'
        ? bindings.arrayLengths.get(container.path)
        : undefined;
  if (method === 'shift') return length === 0 ? null : '0';
  if (method === 'pop') {
    return length === undefined
      ? undefined
      : length === 0
        ? null
        : `${length - 1}`;
  }
  if (method !== 'at') return undefined;

  if (
    argument?.type === 'ArgumentPlaceholder' ||
    argument?.type === 'SpreadElement'
  ) {
    return undefined;
  }
  const indexValue = argument
    ? readTemplateStaticPrimitive(argument, bindings, shadowed)
    : { ok: true as const, value: 0 };
  if (!indexValue.ok) return undefined;
  if (typeof indexValue.value === 'bigint') return null;
  let index: number;
  try {
    index = Number(indexValue.value);
  } catch {
    return null;
  }
  if (Number.isNaN(index)) index = 0;
  else if (!Number.isFinite(index)) return null;
  index = Math.trunc(index);
  if (index < 0) {
    if (length === undefined) return undefined;
    index += length;
  }
  if (index < 0 || (length !== undefined && index >= length)) return null;
  return String(index);
}

/** Collects only the immediate values that one literal selection may return. */
function collectLiteralContainerCandidates(
  container: babel.ArrayExpression | babel.ObjectExpression,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  if (container.type === 'ArrayExpression') {
    const flattened = flattenTemplateLiteralArray(container, new Set());
    const values = flattened
      ? flattened.filter((value): value is babel.Node => Boolean(value))
      : container.elements.flatMap((element) =>
          !element ? [] : element.type === 'SpreadElement' ? [] : [element]
        );
    const analyses = values.map((value) =>
      collectTemplateSelectorValue(value, bindings, shadowed, seen)
    );
    if (!flattened) {
      for (const element of container.elements) {
        if (element?.type !== 'SpreadElement') continue;
        analyses.push(
          collectTemplateContainerCandidates(
            element.argument,
            bindings,
            shadowed,
            seen
          )
        );
      }
    }
    const result = mergeDynamicSelectorAnalyses(analyses);
    return { ...result, unknown: result.unknown || !flattened };
  }

  const properties = flattenTemplateLiteralObject(container, new Set());
  const finalValues = new Map<string, babel.Node>();
  const uncertainValues: babel.Node[] = [];
  const spreadAnalyses: Array<Omit<DynamicSelectorAnalysis, 'displayName'>> =
    [];
  for (const property of properties ?? container.properties) {
    if (property.type === 'SpreadElement') {
      spreadAnalyses.push(
        collectTemplateContainerCandidates(
          property.argument,
          bindings,
          shadowed,
          seen
        )
      );
      continue;
    }
    const key = readTemplateLiteralPropertyKey(property, bindings, shadowed);
    const value =
      property.type === 'ObjectProperty'
        ? property.value
        : property.type === 'ObjectMethod' && property.kind === 'get'
          ? property
          : undefined;
    if (!value) continue;
    if (key === undefined) uncertainValues.push(value);
    else finalValues.set(key, value);
  }
  const analyses = [...finalValues.values(), ...uncertainValues].map((value) =>
    collectTemplateSelectorValue(value, bindings, shadowed, seen)
  );
  analyses.push(...spreadAnalyses);
  const result = mergeDynamicSelectorAnalyses(analyses);
  return {
    ...result,
    unknown:
      result.unknown || properties === undefined || uncertainValues.length > 0,
  };
}

/** Preserves a nested literal as a container instead of flattening its leaves. */
function collectTemplateSelectorValue(
  node: babel.Node,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  if (node.type === 'ObjectMethod' && node.kind === 'get') {
    const returns = collectTemplateFunctionReturns(node);
    const result = mergeDynamicSelectorAnalyses(
      returns.map((value) =>
        collectTemplateSelectorValue(value, bindings, shadowed, seen)
      )
    );
    return { ...result, unknown: true };
  }
  const expression = unwrapExpression(node);
  if (
    expression?.type === 'ArrayExpression' ||
    expression?.type === 'ObjectExpression'
  ) {
    return {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [{ kind: 'literal', node: expression }],
    };
  }
  const path = readStaticTemplateMemberPath(expression, bindings, shadowed);
  if (path && bindings.containerKinds.has(path)) {
    return {
      ...emptyDynamicSelectorAnalysis(false),
      containers: [{ kind: 'path', path }],
    };
  }
  return expression
    ? collectDynamicSelectorCandidates(expression, bindings, shadowed, seen)
    : emptyDynamicSelectorAnalysis(true);
}

/** Collects returns from one function body without entering nested functions. */
function collectTemplateCallableReturnAnalysis(
  fn:
    | babel.ArrowFunctionExpression
    | babel.FunctionExpression
    | babel.ObjectMethod,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  return mergeDynamicSelectorAnalyses(
    collectTemplateFunctionReturns(fn).map((value) =>
      collectTemplateSelectorValue(value, bindings, shadowed, seen)
    )
  );
}

function collectTemplateFunctionReturns(
  fn:
    | babel.ArrowFunctionExpression
    | babel.FunctionExpression
    | babel.ObjectMethod
): babel.Expression[] {
  if (
    fn.type === 'ArrowFunctionExpression' &&
    fn.body.type !== 'BlockStatement'
  ) {
    return [fn.body];
  }
  const returns: babel.Expression[] = [];
  const visit = (node: babel.Node): void => {
    if (node !== fn && babel.isFunction(node)) return;
    if (node.type === 'ReturnStatement') {
      if (node.argument && babel.isExpression(node.argument)) {
        returns.push(node.argument);
      }
      return;
    }
    for (const key of babel.VISITOR_KEYS[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const entry of child) {
          if (entry && typeof entry === 'object' && 'type' in entry) {
            visit(entry as babel.Node);
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        visit(child as babel.Node);
      }
    }
  };
  visit(fn);
  return returns;
}

/** Expands literal-only object spreads while preserving property write order. */
function flattenTemplateLiteralObject(
  object: babel.ObjectExpression,
  seen: Set<babel.Node>
): babel.ObjectExpression['properties'] | undefined {
  if (seen.has(object)) return undefined;
  const nextSeen = new Set(seen).add(object);
  const properties: babel.ObjectExpression['properties'] = [];
  for (const property of object.properties) {
    if (property.type !== 'SpreadElement') {
      properties.push(property);
      continue;
    }
    const argument = unwrapExpression(property.argument);
    if (argument?.type !== 'ObjectExpression') return undefined;
    const spread = flattenTemplateLiteralObject(argument, nextSeen);
    if (!spread) return undefined;
    properties.push(...spread);
  }
  return properties;
}

/** Resolves a literal object key without executing user code. */
function readTemplateLiteralPropertyKey(
  property: babel.ObjectExpression['properties'][number],
  bindings: TemplateBindings,
  shadowed: Set<string>
): string | undefined {
  if (property.type === 'SpreadElement') return undefined;
  if (!property.computed && property.key.type === 'Identifier') {
    return property.key.name;
  }
  if (property.key.type === 'StringLiteral') return property.key.value;
  if (property.key.type === 'NumericLiteral') return String(property.key.value);
  if (!property.computed) return undefined;
  const key = readTemplateStaticPrimitive(property.key, bindings, shadowed);
  return key.ok &&
    (typeof key.value === 'string' || typeof key.value === 'number')
    ? String(key.value)
    : undefined;
}

/** Collects exact component-bearing descendants exposed by script analysis. */
function collectExposedContainerCandidates(
  path: string,
  bindings: TemplateBindings
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const candidates = new Map<string, DynamicSelectorCandidate>();
  const componentFactories = new Set<string>();
  const containers: DynamicSelectorContainer[] = [];
  const gtComponentFactories = new Set<string>();
  const prefix = `${path}.`;
  const isImmediateChild = (name: string) => {
    if (!name.startsWith(prefix)) return false;
    const suffix = name.slice(prefix.length);
    return !suffix.includes('.');
  };
  const addExpression = (name: string) => {
    if (!isImmediateChild(name)) return;
    candidates.set(`expression:${name}`, { kind: 'expression', name });
  };

  for (const name of bindings.components.keys()) addExpression(name);
  for (const name of bindings.vueBuiltins.keys()) addExpression(name);
  for (const name of bindings.uncertainComponents) addExpression(name);
  for (const [name, value] of bindings.staticValues) {
    if (isImmediateChild(name) && typeof value === 'string') {
      candidates.set(`string:${value}`, { kind: 'string', name: value });
    }
  }
  for (const [name, values] of bindings.possibleStaticStrings) {
    if (!isImmediateChild(name)) continue;
    for (const value of values) {
      candidates.set(`string:${value}`, { kind: 'string', name: value });
    }
  }
  for (const name of bindings.componentFactories) {
    if (!isImmediateChild(name)) continue;
    componentFactories.add(name);
    addExpression(name);
  }
  for (const name of bindings.gtComponentFactories) {
    if (!isImmediateChild(name)) continue;
    gtComponentFactories.add(name);
    addExpression(name);
  }
  for (const [name] of bindings.containerKinds) {
    if (isImmediateChild(name)) containers.push({ kind: 'path', path: name });
  }
  const addNestedContainer = (
    name: string,
    requireNestedChild: boolean
  ): void => {
    if (!name.startsWith(prefix)) return;
    const suffix = name.slice(prefix.length);
    if (requireNestedChild && !suffix.includes('.')) return;
    const firstSegment = suffix.split('.', 1)[0];
    if (!firstSegment) return;
    const childPath = `${prefix}${firstSegment}`;
    if (
      !containers.some(
        (container) => container.kind === 'path' && container.path === childPath
      )
    ) {
      containers.push({ kind: 'path', path: childPath });
    }
  };
  for (const name of bindings.possibleGTContainers) {
    addNestedContainer(name, false);
  }
  for (const name of bindings.possibleStaticStrings.keys()) {
    addNestedContainer(name, true);
  }

  return {
    candidates: [...candidates.values()],
    componentFactories,
    containers,
    gtComponentFactories,
    possibleGT: findPossibleGTContainerPath(path, bindings) !== undefined,
    unknown: true,
  };
}

/** Returns whether selecting one direct child of a tainted path can yield T. */
function templatePathSelectsPossibleGT(
  path: string,
  bindings: TemplateBindings
): boolean {
  const separator = path.lastIndexOf('.');
  return (
    separator > 0 &&
    findPossibleGTContainerPath(path.slice(0, separator), bindings) !==
      undefined
  );
}

/** Finds an exact or wildcard tainted-container path. */
function findPossibleGTContainerPath(
  path: string,
  bindings: TemplateBindings
): string | undefined {
  if (bindings.possibleGTContainers.has(path)) return path;
  const wildcard = appendTemplatePath('', unknownTemplatePathSegment).slice(1);
  const recursiveSuffix = appendTemplatePath('', recursiveTemplatePathSegment);
  const segments = path.split('.');
  for (const candidate of bindings.possibleGTContainers) {
    if (candidate.endsWith(recursiveSuffix)) {
      const recursiveRoot = candidate.slice(0, -recursiveSuffix.length);
      if (path === recursiveRoot || path.startsWith(`${recursiveRoot}.`)) {
        return candidate;
      }
    }
    const candidateSegments = candidate.split('.');
    if (
      candidateSegments.length === segments.length &&
      candidateSegments.every(
        (segment, index) => segment === wildcard || segment === segments[index]
      )
    ) {
      return candidate;
    }
  }
  return undefined;
}

/** Returns whether one selected child contains a tainted container path. */
function hasImmediatePossibleGTContainerChild(
  path: string,
  bindings: TemplateBindings
): boolean {
  const prefix = `${path}.`;
  return [...bindings.possibleGTContainers].some((candidate) =>
    candidate.startsWith(prefix)
  );
}

/** Returns whether one selected child can expose a known selector string. */
function hasPossibleStaticStringChild(
  path: string,
  bindings: TemplateBindings
): boolean {
  const prefix = `${path}.`;
  return [...bindings.possibleStaticStrings].some(
    ([candidate, values]) => candidate.startsWith(prefix) && values.size > 0
  );
}

/** Selects through nested literal member chains in a template expression. */
function selectTemplateStaticMemberExpression(
  node: babel.Node,
  key: string,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  seen: Set<babel.Node>
): babel.Node | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  const nextSeen = new Set(seen).add(expression);
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const parentKey = readStaticTemplateMemberProperty(
      expression,
      bindings,
      shadowed
    );
    const parent =
      parentKey === undefined
        ? undefined
        : selectTemplateStaticMemberExpression(
            expression.object,
            parentKey,
            bindings,
            shadowed,
            nextSeen
          );
    return parent
      ? selectTemplateStaticMemberExpression(
          parent,
          key,
          bindings,
          shadowed,
          nextSeen
        )
      : undefined;
  }
  return selectTemplateLiteralMember(expression, key);
}

function selectorAnalysisIsKnownComponent(
  analysis: Omit<DynamicSelectorAnalysis, 'displayName'>,
  bindings: TemplateBindings
): boolean {
  return (
    !analysis.unknown &&
    analysis.componentFactories.size === 0 &&
    analysis.candidates.length > 0 &&
    analysis.candidates.every((candidate) =>
      [...normalizeTemplateBindingNames(candidate.name)].some((name) =>
        candidate.kind === 'string'
          ? bindings.registeredComponents.has(name) ||
            bindings.registeredVueBuiltins.has(name)
          : bindings.components.has(name) || bindings.vueBuiltins.has(name)
      )
    )
  );
}

function selectorCandidate(
  kind: DynamicSelectorCandidate['kind'],
  name: string
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  return {
    candidates: [{ kind, name }],
    componentFactories: new Set(),
    containers: [],
    gtComponentFactories: new Set(),
    possibleGT: false,
    unknown: false,
  };
}

function emptyDynamicSelectorAnalysis(
  unknown: boolean
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  return {
    candidates: [],
    componentFactories: new Set(),
    containers: [],
    gtComponentFactories: new Set(),
    possibleGT: false,
    unknown,
  };
}

function mergeDynamicSelectorAnalyses(
  analyses: Array<Omit<DynamicSelectorAnalysis, 'displayName'>>
): Omit<DynamicSelectorAnalysis, 'displayName'> {
  const candidates = new Map<string, DynamicSelectorCandidate>();
  const componentFactories = new Set<string>();
  const containers: DynamicSelectorContainer[] = [];
  const containerPaths = new Set<string>();
  const literalContainers = new Set<babel.Node>();
  const abstractContainers = new Set<DynamicSelectorContainer>();
  const gtComponentFactories = new Set<string>();
  let possibleGT = false;
  let unknown = false;
  for (const analysis of analyses) {
    possibleGT ||= analysis.possibleGT;
    unknown ||= analysis.unknown;
    for (const candidate of analysis.candidates) {
      candidates.set(`${candidate.kind}:${candidate.name}`, candidate);
    }
    for (const name of analysis.componentFactories) {
      componentFactories.add(name);
    }
    for (const container of analysis.containers) {
      if (container.kind === 'path') {
        if (containerPaths.has(container.path)) continue;
        containerPaths.add(container.path);
      } else if (container.kind === 'literal') {
        if (literalContainers.has(container.node)) continue;
        literalContainers.add(container.node);
      } else {
        if (abstractContainers.has(container)) continue;
        abstractContainers.add(container);
      }
      containers.push(container);
    }
    for (const name of analysis.gtComponentFactories) {
      gtComponentFactories.add(name);
    }
  }
  return {
    candidates: [...candidates.values()],
    componentFactories,
    containers,
    gtComponentFactories,
    possibleGT,
    unknown,
  };
}

/** Selects a literal array/object member used directly in a template. */
function selectTemplateLiteralMember(
  node: babel.Node,
  key: string
): babel.Node | undefined {
  const expression = unwrapExpression(node);
  if (expression?.type === 'ArrayExpression') {
    const index = key.match(/^(0|[1-9]\d*)$/) ? Number(key) : undefined;
    const elements = flattenTemplateLiteralArray(expression, new Set());
    return index === undefined ? undefined : elements?.[index];
  }
  if (expression?.type !== 'ObjectExpression') return undefined;
  const properties =
    flattenTemplateLiteralObject(expression, new Set()) ??
    expression.properties;
  let selected: babel.Node | undefined;
  let uncertainWriteAfterSelection = false;
  for (const property of properties) {
    if (property.type === 'SpreadElement') {
      uncertainWriteAfterSelection = true;
      continue;
    }
    const propertyKey =
      !property.computed && property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'StringLiteral'
          ? property.key.value
          : property.key.type === 'NumericLiteral'
            ? String(property.key.value)
            : undefined;
    if (propertyKey === undefined) {
      uncertainWriteAfterSelection = true;
      continue;
    }
    if (propertyKey === key) {
      selected =
        property.type === 'ObjectProperty' || property.type === 'ObjectMethod'
          ? property.type === 'ObjectProperty'
            ? property.value
            : property
          : undefined;
      uncertainWriteAfterSelection = false;
    }
  }
  return uncertainWriteAfterSelection ? undefined : selected;
}

/** Returns whether an unresolved literal member can be supplied by a spread. */
function templateLiteralMemberIsUncertain(
  node: babel.ArrayExpression | babel.ObjectExpression,
  key: string
): boolean {
  if (node.type === 'ArrayExpression') {
    return (
      /^(0|[1-9]\d*)$/.test(key) &&
      flattenTemplateLiteralArray(node, new Set()) === undefined
    );
  }
  if (flattenTemplateLiteralObject(node, new Set())) return false;
  let uncertain = false;
  for (const property of node.properties) {
    if (property.type === 'SpreadElement') {
      uncertain = true;
      continue;
    }
    const propertyKey =
      !property.computed && property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'StringLiteral'
          ? property.key.value
          : property.key.type === 'NumericLiteral'
            ? String(property.key.value)
            : undefined;
    if (propertyKey === undefined) uncertain = true;
    else if (propertyKey === key) uncertain = false;
  }
  return uncertain;
}

/** Flattens array spreads only when every spread operand is another literal. */
function flattenTemplateLiteralArray(
  array: babel.ArrayExpression,
  seen: Set<babel.Node>
): Array<babel.Node | undefined> | undefined {
  if (seen.has(array)) return undefined;
  const nextSeen = new Set(seen).add(array);
  const elements: Array<babel.Node | undefined> = [];
  for (const element of array.elements) {
    if (!element) {
      elements.push(undefined);
      continue;
    }
    if (element.type !== 'SpreadElement') {
      elements.push(element);
      continue;
    }
    const argument = unwrapExpression(element.argument);
    if (argument?.type !== 'ArrayExpression') return undefined;
    const spread = flattenTemplateLiteralArray(argument, nextSeen);
    if (!spread) return undefined;
    elements.push(...spread);
  }
  return elements;
}

/** Resolves a computed member key from literals or exposed static bindings. */
function readStaticTemplateMemberProperty(
  node: babel.MemberExpression | babel.OptionalMemberExpression,
  bindings: TemplateBindings,
  shadowed: Set<string>
): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  if (!node.computed) return undefined;
  const property = readTemplateStaticPrimitive(
    node.property,
    bindings,
    shadowed
  );
  return property.ok &&
    (typeof property.value === 'string' || typeof property.value === 'number')
    ? String(property.value)
    : undefined;
}

function readTemplateStaticPrimitive(
  node: babel.Node,
  bindings: TemplateBindings,
  shadowed: Set<string>,
  allowNumericGlobals = false
) {
  return readStaticPrimitive(node, (identifier) => {
    if (shadowed.has(identifier.name)) {
      return { ok: false };
    }
    if (bindings.staticValues.has(identifier.name)) {
      return { ok: true, value: bindings.staticValues.get(identifier.name)! };
    }
    if (
      allowNumericGlobals &&
      !bindings.directBindings.has(identifier.name) &&
      identifier.name === 'Infinity'
    ) {
      return { ok: true, value: Number.POSITIVE_INFINITY };
    }
    if (
      allowNumericGlobals &&
      !bindings.directBindings.has(identifier.name) &&
      identifier.name === 'NaN'
    ) {
      return { ok: true, value: Number.NaN };
    }
    return { ok: false };
  });
}

/** Reads a dotted template member chain without evaluating runtime code. */
function readStaticTemplateMemberPath(
  node: babel.Node | undefined,
  bindings: TemplateBindings,
  shadowed: Set<string>
): string | undefined {
  const expression = unwrapExpression(node);
  if (!expression) return undefined;
  if (expression.type === 'Identifier') {
    return shadowed.has(expression.name) ? undefined : expression.name;
  }
  if (
    expression.type !== 'MemberExpression' &&
    expression.type !== 'OptionalMemberExpression'
  ) {
    return undefined;
  }
  const object = readStaticTemplateMemberPath(
    expression.object,
    bindings,
    shadowed
  );
  const property = readStaticTemplateMemberProperty(
    expression,
    bindings,
    shadowed
  );
  return object && property !== undefined
    ? appendTemplatePath(object, property)
    : undefined;
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
