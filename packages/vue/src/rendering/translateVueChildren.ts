import {
  HTML_CONTENT_PROPS,
  type GTProp,
  type JsxChild,
  type JsxChildren,
  type JsxElement,
  type Variable,
  type VariableType,
} from 'generaltranslation/types';
import type { HtmlContentPropKeysRecord } from 'generaltranslation/types';
import {
  getPluralForm,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';
import { hashSource } from 'generaltranslation/id';
import {
  Comment,
  Fragment,
  Suspense,
  Text,
  cloneVNode,
  h,
  isVNode,
  mergeProps,
  type Component,
  type Slots,
  type VNode,
  type VNodeChild,
} from 'vue';
import { getFormatLocales, isBranchAttribute } from '../components/utils';
import type { GTState } from '../types';

const variableTypes = {
  currency: { name: 'cost', type: 'c' },
  datetime: { name: 'date', type: 'd' },
  number: { name: 'n', type: 'n' },
  variable: { name: 'value', type: 'v' },
} as const satisfies Record<string, { name: string; type: VariableType }>;

type Transformation = 'branch' | 'fragment' | 'plural' | 'variable' | undefined;

type SourceElement = {
  branches: Record<string, SourceNode[]>;
  children: SourceNode[];
  id: number;
  identity: string;
  opaque: boolean;
  preserveExplicitKey: boolean;
  transformation: Transformation;
  variableName?: string;
  variableType?: VariableType;
  vnode: VNode;
};

type SourceNode = SourceElement | string;

type ComponentWithGTMetadata = Component & {
  _gtt?: string;
  __name?: string;
  name?: string;
};

type RichTranslationOptions = {
  /** @internal React-compatible alias accepted for compiler output. */
  $context?: string;
  _hash?: string;
  context?: string;
};

/** Runtime-only reconciliation state owned by one mounted `T` instance. */
export type TranslationIdentityCache = {
  /** Stable scope tokens for user-authored Vue keys, without coercion. */
  explicitScopes: Map<PropertyKey, string>;
  /** Stable Vue keys generated for source identities and repeated references. */
  generatedKeys: Map<string, symbol>;
  /** Monotonic token source for explicit keys first observed by this `T`. */
  nextExplicitScope: number;
  /** Monotonic token source for VNode types first observed by this `T`. */
  nextTypeScope: number;
  /** Stable scope tokens for component objects, functions, and native tags. */
  typeScopes: Map<unknown, string>;
};

type VNodeWithRenderMetadata = VNode & {
  ctx?: unknown;
  slotScopeIds?: string[] | null;
  ssContent?: VNode;
  ssFallback?: VNode;
};

export function translateVueChildren(
  children: VNode[],
  state: GTState,
  options: RichTranslationOptions,
  identityCache: TranslationIdentityCache = createTranslationIdentityCache()
): VNodeChild {
  const source = createSourceNodes(children, identityCache);
  if (state.locale.value === state.defaultLocale) {
    return renderDefaultNodes(
      source,
      state,
      identityCache,
      state.defaultLocale
    );
  }
  const hash =
    options._hash ??
    hashSource({
      context: options.context ?? options.$context,
      dataFormat: 'JSX',
      source: serializeNodes(source),
    });
  const target = state.getCatalog()[hash];
  if (target == null) {
    return renderDefaultNodes(
      source,
      state,
      identityCache,
      state.defaultLocale
    );
  }
  return renderNodes(source, target, state, identityCache);
}

/** Creates the per-T reconciliation cache shared by each reactive render. */
export function createTranslationIdentityCache(): TranslationIdentityCache {
  return {
    explicitScopes: new Map(),
    generatedKeys: new Map(),
    nextExplicitScope: 0,
    nextTypeScope: 0,
    typeScopes: new Map(),
  };
}

/**
 * Serializes compiled Vue slot children into the complete persisted GT source.
 *
 * This internal seam exists so compiler/extractor parity tests can compare
 * element IDs, variable names, and branches before `hashSource()` deliberately
 * removes identity-only fields.
 */
export function serializeVueChildren(children: VNode[]): JsxChildren {
  return serializeNodes(
    createSourceNodes(children, createTranslationIdentityCache())
  );
}

function createSourceNodes(
  children: unknown,
  identityCache: TranslationIdentityCache
): SourceNode[] {
  const index = { value: 0 };
  return visitChildren(children, index, 'root', identityCache);
}

function visitChildren(
  children: unknown,
  index: { value: number },
  identityScope: string,
  identityCache: TranslationIdentityCache,
  identityOccurrences: Map<string, number> = new Map(),
  transparentKeyScope = false
): SourceNode[] {
  if (Array.isArray(children)) {
    return mergeAdjacentStrings(
      children.flatMap((child) =>
        visitChildren(
          child,
          index,
          identityScope,
          identityCache,
          identityOccurrences,
          transparentKeyScope
        )
      )
    );
  }
  if (children == null || typeof children === 'boolean') return [];
  if (!isVNode(children)) return [String(children)];
  if (children.type === Comment) return [];
  if (children.type === Text) return [String(children.children ?? '')];
  if (children.type === Fragment) {
    const fragmentChildren = isSlots(children.children)
      ? children.children.default?.()
      : children.children;
    if (children.key != null) {
      return visitChildren(
        fragmentChildren,
        index,
        getExplicitIdentityScope(identityScope, children.key, identityCache),
        identityCache,
        new Map(),
        true
      );
    }
    return visitChildren(
      fragmentChildren,
      index,
      identityScope,
      identityCache,
      identityOccurrences,
      transparentKeyScope
    );
  }

  index.value += 1;
  const id = index.value;
  let identity: string;
  if (children.key == null) {
    const typeScope = getVNodeTypeScope(children.type, identityCache);
    const occurrence = (identityOccurrences.get(typeScope) ?? 0) + 1;
    identityOccurrences.set(typeScope, occurrence);
    identity = `${identityScope}/${typeScope}/o:${occurrence}`;
  } else {
    identity = getExplicitIdentityScope(
      identityScope,
      children.key,
      identityCache
    );
  }
  const metadata = getGTMetadata(children);
  const transformation = getTransformation(metadata);
  const variable =
    transformation === 'variable' ? getVariable(metadata, id) : undefined;
  const defaultSlot = variable
    ? { children: undefined, opaque: false }
    : readDefaultSlot(children, transformation);
  const source: SourceElement = {
    branches: {},
    children:
      variable || defaultSlot.opaque
        ? []
        : visitChildren(
            defaultSlot.children,
            index,
            transformation === 'branch' || transformation === 'plural'
              ? `${identity}/default`
              : identity,
            identityCache
          ),
    id,
    identity,
    opaque: defaultSlot.opaque,
    preserveExplicitKey: !transparentKeyScope,
    transformation,
    variableName: variable?.name,
    variableType: variable?.type,
    vnode: children,
  };

  if (transformation === 'branch' || transformation === 'plural') {
    source.branches = getBranches(
      children,
      transformation,
      id,
      identity,
      identityCache
    );
  }
  return [source];
}

/** Gives each distinct Vue VNode type a stable per-T identity token. */
function getVNodeTypeScope(
  type: unknown,
  identityCache: TranslationIdentityCache
): string {
  let scope = identityCache.typeScopes.get(type);
  if (!scope) {
    identityCache.nextTypeScope += 1;
    scope = `t:${identityCache.nextTypeScope}`;
    identityCache.typeScopes.set(type, scope);
  }
  return scope;
}

/** Anchors descendant identity to an explicit Vue key without string coercion. */
function getExplicitIdentityScope(
  parentScope: string,
  key: PropertyKey,
  identityCache: TranslationIdentityCache
): string {
  let scope = identityCache.explicitScopes.get(key);
  if (!scope) {
    identityCache.nextExplicitScope += 1;
    scope = `k:${identityCache.nextExplicitScope}`;
    identityCache.explicitScopes.set(key, scope);
  }
  return `${parentScope}/${scope}`;
}

function getGTMetadata(vnode: VNode): string | undefined {
  if (typeof vnode.type !== 'function' && typeof vnode.type !== 'object') {
    return undefined;
  }
  return (vnode.type as ComponentWithGTMetadata)._gtt;
}

function getTransformation(metadata?: string): Transformation {
  const [type] = metadata?.split('-') ?? [];
  if (type === 'translate') return 'fragment';
  if (type === 'branch' || type === 'plural' || type === 'variable') {
    return type;
  }
  return undefined;
}

function getVariable(
  metadata: string | undefined,
  id: number
): { name: string; type: VariableType } {
  const variableType = metadata?.split('-')[1] ?? 'variable';
  const variable =
    variableTypes[variableType as keyof typeof variableTypes] ??
    variableTypes.variable;
  return {
    name: `_gt_${variable.name}_${id}`,
    type: variable.type,
  };
}

/**
 * Reads source-owned content without speculatively invoking user components.
 *
 * Vue represents both scoped and unscoped component slots as indistinguishable
 * functions. Calling an arbitrary slot to discover which kind it is can run
 * ignored slots, duplicate side effects, or let synthetic props escape. Keep
 * custom component slots opaque and traverse only GT-owned slots whose
 * no-argument contract is known. Suspense is read from Vue's already-normalized
 * content so its slot is not invoked a second time.
 */
function readDefaultSlot(
  vnode: VNode,
  transformation: Transformation
): {
  children: unknown;
  opaque: boolean;
} {
  if (vnode.type === Suspense) {
    return {
      children: (vnode as VNodeWithRenderMetadata).ssContent,
      opaque: false,
    };
  }
  if (transformation === undefined && typeof vnode.type !== 'string') {
    return { children: undefined, opaque: true };
  }
  if (!isSlots(vnode.children)) {
    return { children: vnode.children, opaque: false };
  }
  return { children: vnode.children.default?.(), opaque: false };
}

function getBranches(
  vnode: VNode,
  transformation: 'branch' | 'plural',
  branchElementId: number,
  identity: string,
  identityCache: TranslationIdentityCache
): Record<string, SourceNode[]> {
  const inputs = Object.create(null) as Record<string, unknown>;
  if (isSlots(vnode.children)) {
    for (const [key, slot] of Object.entries(vnode.children)) {
      if (
        key !== 'default' &&
        !key.startsWith('_') &&
        typeof slot === 'function'
      ) {
        inputs[key] = slot();
      }
    }
  }
  for (const [key, value] of Object.entries(vnode.props ?? {})) {
    if (
      isBranchAttribute(key, value) &&
      !Object.prototype.hasOwnProperty.call(inputs, key)
    ) {
      inputs[key] = value;
    }
  }

  return Object.fromEntries(
    Object.entries(inputs)
      .filter(
        ([key]) => transformation === 'branch' || isAcceptedPluralForm(key)
      )
      // Branches are mutually exclusive. Number each one independently from
      // the parent so they share stable variable names and do not shift later
      // siblings, matching the React renderer.
      .map(([key, value]) => [
        key,
        visitChildren(
          value,
          { value: branchElementId },
          `${identity}/branch:${key.length}:${key}`,
          identityCache
        ),
      ])
  );
}

function isSlots(children: unknown): children is Slots {
  return !!children && typeof children === 'object' && !Array.isArray(children);
}

function serializeNodes(nodes: SourceNode[]): JsxChildren {
  const serialized = nodes.map(serializeNode);
  return serialized.length === 1 ? serialized[0] : serialized;
}

function serializeNode(node: SourceNode): JsxChild {
  if (typeof node === 'string') return node;
  if (node.transformation === 'variable') {
    return {
      i: node.id,
      k: node.variableName ?? `_gt_value_${node.id}`,
      v: node.variableType ?? 'v',
    };
  }

  const data: GTProp = {};
  for (const [shortName, propName] of Object.entries(HTML_CONTENT_PROPS)) {
    const value = node.vnode.props?.[propName];
    if (typeof value === 'string') {
      data[shortName as keyof HtmlContentPropKeysRecord] = value;
    }
  }
  if (
    (node.transformation === 'branch' || node.transformation === 'plural') &&
    Object.keys(node.branches).length
  ) {
    data.b = Object.fromEntries(
      Object.entries(node.branches).map(([key, branch]) => [
        key,
        serializeNodes(branch),
      ])
    );
    data.t = node.transformation === 'plural' ? 'p' : 'b';
  }

  return {
    t: getElementName(node.vnode, node.id),
    i: node.id,
    ...(Object.keys(data).length && { d: data }),
    ...(node.children.length && { c: serializeNodes(node.children) }),
  };
}

/**
 * Returns a readable element label with a deterministic anonymous fallback.
 * JSX hashing strips element names and IDs, so compiler or minifier naming
 * differences cannot change the catalog key.
 */
function getElementName(vnode: VNode, id: number): string {
  const fallback = `C${id}`;
  if (typeof vnode.type === 'string') return vnode.type;
  if (typeof vnode.type === 'function') return vnode.type.name || fallback;
  if (typeof vnode.type === 'object') {
    const type = vnode.type as ComponentWithGTMetadata;
    return type.name || type.__name || fallback;
  }
  return fallback;
}

function renderNodes(
  source: SourceNode[],
  target: JsxChildren | undefined,
  state: GTState,
  identityCache: TranslationIdentityCache
): VNodeChild {
  if (target == null) {
    // A partial translated tree falls back within the active locale. A wholly
    // missing catalog entry is handled above using the source/default locale.
    return renderDefaultNodes(source, state, identityCache, state.locale.value);
  }
  if (typeof target === 'string') return target;

  const targets = Array.isArray(target) ? target : [target];
  const sourceElements = source.filter(
    (node): node is SourceElement => typeof node !== 'string'
  );
  const variables = new Map(
    sourceElements
      .filter((node) => node.transformation === 'variable')
      .map((node) => [node.variableName, node])
  );
  const ordinary = sourceElements.filter(
    (node) => node.transformation !== 'variable'
  );
  const ordinaryById = new Map(ordinary.map((node) => [node.id, node]));
  const fallback = [...ordinary];
  const occurrences = new Map<SourceElement, number>();

  return targets.map((targetNode) => {
    if (typeof targetNode === 'string') return targetNode;
    if (isVariable(targetNode)) {
      const variable = variables.get(targetNode.k);
      return variable
        ? keySourceResult(
            variable,
            renderDefaultNode(
              variable,
              state,
              identityCache,
              state.locale.value
            ),
            occurrences,
            identityCache
          )
        : null;
    }

    // An explicit target ID is a reusable reference, while order-based
    // fallback consumes each source node once. Translations may intentionally
    // repeat one source element without rebinding later copies to siblings.
    const sourceNode =
      (targetNode.i == null ? undefined : ordinaryById.get(targetNode.i)) ??
      fallback.shift();
    return sourceNode
      ? keySourceResult(
          sourceNode,
          renderElement(sourceNode, targetNode, state, identityCache),
          occurrences,
          identityCache
        )
      : null;
  });
}

/**
 * Gives every source-backed sibling a stable reconciliation identity.
 *
 * Catalogs may reorder, omit, or repeat a source ID. The occurrence suffix
 * keeps repeated references unique, while the first occurrence retains the
 * same key as the default tree. Explicit user keys remain authoritative;
 * generated Symbols cannot collide with them.
 */
function keySourceResult(
  source: SourceElement,
  rendered: VNodeChild,
  occurrences: Map<SourceElement, number>,
  identityCache: TranslationIdentityCache
): VNode {
  const occurrence = occurrences.get(source) ?? 0;
  occurrences.set(source, occurrence + 1);

  const explicitKey =
    occurrence === 0 && source.preserveExplicitKey ? source.vnode.key : null;
  const cacheKey = `${source.identity}/occurrence:${occurrence}`;
  let key: PropertyKey;
  if (explicitKey != null) {
    key = explicitKey;
  } else {
    let generatedKey = identityCache.generatedKeys.get(cacheKey);
    if (!generatedKey) {
      generatedKey = Symbol(cacheKey);
      identityCache.generatedKeys.set(cacheKey, generatedKey);
    }
    key = generatedKey;
  }

  if (isVNode(rendered)) {
    if (rendered.key === key) return rendered;
    const cloned = cloneVNode(rendered);
    cloned.key = key;
    return cloned;
  }

  const children =
    rendered == null ? [] : Array.isArray(rendered) ? rendered : [rendered];
  return h(Fragment, { key }, children);
}

function renderElement(
  source: SourceElement,
  target: JsxElement,
  state: GTState,
  identityCache: TranslationIdentityCache
): VNodeChild {
  if (source.transformation === 'branch') {
    const branch = getBranchKey(source.vnode);
    return renderNodes(
      getSelectedSourceBranch(source, branch),
      getSelectedTargetBranch(target, branch),
      state,
      identityCache
    );
  }
  if (source.transformation === 'plural') {
    const n = source.vnode.props?.n;
    if (typeof n !== 'number') {
      return renderDefaultNode(
        source,
        state,
        identityCache,
        state.locale.value
      );
    }
    const sourceBranch = getPluralKey(
      n,
      Object.keys(source.branches),
      source,
      state,
      state.defaultLocale,
      true
    );
    const targetBranches = target.d?.b ?? {};
    const targetBranch = getPluralKey(
      n,
      Object.keys(targetBranches),
      source,
      state
    );
    return renderNodes(
      getSelectedSourceBranch(source, sourceBranch),
      (targetBranch && targetBranches[targetBranch]) ?? target.c,
      state,
      identityCache
    );
  }
  if (source.transformation === 'fragment') {
    return renderNodes(source.children, target.c, state, identityCache);
  }
  if (source.opaque) {
    const translatedProps = getTranslatedProps(target);
    return Object.keys(translatedProps).length
      ? cloneWithProps(source.vnode, translatedProps)
      : source.vnode;
  }
  const translatedProps = getTranslatedProps(target);
  if (target.c == null) {
    return source.children.length
      ? cloneWithChildren(
          source.vnode,
          renderDefaultNodes(
            source.children,
            state,
            identityCache,
            state.locale.value
          ),
          translatedProps
        )
      : Object.keys(translatedProps).length
        ? cloneWithProps(source.vnode, translatedProps)
        : source.vnode;
  }

  return cloneWithChildren(
    source.vnode,
    renderNodes(source.children, target.c, state, identityCache),
    translatedProps
  );
}

function getBranchKey(source: VNode): string | undefined {
  const branch = source.props?.branch;
  if (branch == null) return undefined;
  const key = String(branch);
  return key && !key.startsWith('data-') ? key : undefined;
}

function getPluralKey(
  n: number,
  branches: string[],
  source: SourceElement,
  state: GTState,
  locale = state.locale.value,
  includeSourceLocales = false
): string | undefined {
  const forms = branches.filter(isAcceptedPluralForm);
  if (!forms.length) return undefined;
  const sourceLocales =
    includeSourceLocales && Array.isArray(source.vnode.props?.locales)
      ? source.vnode.props.locales.filter(
          (locale): locale is string => typeof locale === 'string'
        )
      : [];
  return (
    getPluralForm(
      n,
      forms,
      getFormatLocales(sourceLocales, locale, state.defaultLocale)
    ) || undefined
  );
}

function getSelectedSourceBranch(
  source: SourceElement,
  branch?: string
): SourceNode[] {
  return branch && Object.hasOwn(source.branches, branch)
    ? source.branches[branch]
    : source.children;
}

function getSelectedTargetBranch(
  target: JsxElement,
  branch?: string
): JsxChildren | undefined {
  return branch && target.d?.b && Object.hasOwn(target.d.b, branch)
    ? target.d.b[branch]
    : target.c;
}

function mergeAdjacentStrings(nodes: SourceNode[]): SourceNode[] {
  const result: SourceNode[] = [];
  for (const node of nodes) {
    const previous = result.at(-1);
    if (typeof previous === 'string' && typeof node === 'string') {
      result[result.length - 1] = previous + node;
    } else {
      result.push(node);
    }
  }
  return result;
}

function getTranslatedProps(target: JsxElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [shortName, propName] of Object.entries(HTML_CONTENT_PROPS)) {
    const value = target.d?.[shortName as keyof HtmlContentPropKeysRecord];
    if (typeof value === 'string') result[propName] = value;
  }
  return result;
}

function renderDefaultNodes(
  nodes: SourceNode[],
  state: GTState,
  identityCache: TranslationIdentityCache,
  locale: string
): VNodeChild[] {
  const occurrences = new Map<SourceElement, number>();
  return nodes.map((node) =>
    typeof node === 'string'
      ? node
      : keySourceResult(
          node,
          renderDefaultNode(node, state, identityCache, locale),
          occurrences,
          identityCache
        )
  );
}

function renderDefaultNode(
  node: SourceNode,
  state: GTState,
  identityCache: TranslationIdentityCache,
  locale: string
): VNodeChild {
  if (typeof node === 'string') return node;
  if (node.transformation === 'variable') {
    return node.variableType !== 'v'
      ? cloneWithProps(node.vnode, { _locale: locale })
      : node.vnode;
  }
  if (node.transformation === 'fragment') {
    return renderDefaultNodes(node.children, state, identityCache, locale);
  }
  if (node.transformation === 'branch') {
    return renderDefaultNodes(
      getSelectedSourceBranch(node, getBranchKey(node.vnode)),
      state,
      identityCache,
      locale
    );
  }
  if (node.transformation === 'plural') {
    const n = node.vnode.props?.n;
    if (typeof n !== 'number') {
      return renderDefaultNodes(node.children, state, identityCache, locale);
    }
    const branch = getPluralKey(
      n,
      Object.keys(node.branches),
      node,
      state,
      locale,
      true
    );
    return renderDefaultNodes(
      getSelectedSourceBranch(node, branch),
      state,
      identityCache,
      locale
    );
  }
  if (!node.children.length) return node.vnode;
  return cloneWithChildren(
    node.vnode,
    renderDefaultNodes(node.children, state, identityCache, locale)
  );
}

function cloneWithChildren(
  vnode: VNode,
  children: VNodeChild,
  extraProps: Record<string, string> = {}
): VNode {
  if (typeof vnode.type === 'string') {
    const props = Object.keys(extraProps).length
      ? mergeProps(vnode.props ?? {}, extraProps)
      : vnode.props;
    const cloned = h(vnode.type, props, children ?? undefined);

    // cloneVNode retains the source VNode's child shape flags and its public
    // API cannot replace and renormalize children. Rich translations can
    // change an element from array children to scalar text, so create a fresh
    // element with normalized children and copy only the render metadata that
    // must survive reconstruction.
    return copyRenderMetadata(cloned, vnode);
  }

  if (vnode.type === Suspense) {
    const props = Object.keys(extraProps).length
      ? mergeProps(vnode.props ?? {}, extraProps)
      : vnode.props;
    const slots = isSlots(vnode.children) ? vnode.children : {};
    const normalizedContent = (vnode as VNodeWithRenderMetadata).ssContent;
    const normalizedFallback = (vnode as VNodeWithRenderMetadata).ssFallback;
    const cloned = h(vnode.type, props, {
      ...slots,
      default: () => rebuildSuspenseContent(children, normalizedContent),
      // Vue already invoked and normalized the fallback when it created the
      // source Suspense VNode. Reuse that VNode instead of running user slot
      // code a second time while rebuilding the translated boundary.
      ...(normalizedFallback && { fallback: () => normalizedFallback }),
    });

    // Vue's VNode clone path preserves already-normalized ssContent and
    // ssFallback from the source. Reconstructing from the public Suspense type
    // recomputes both branches from the replacement slots.
    return copyRenderMetadata(cloned, vnode);
  }

  // Components need their original slot set and identity. cloneVNode cannot
  // safely replace the default slot because it retains optimized block
  // metadata that can suppress later slot updates. Passing a VNode to h()
  // takes Vue's clone-and-renormalize path, preserving the source props and
  // merging only these translated props. Its public overloads do not expose
  // that runtime-supported form.
  const type = vnode as unknown as Component;
  const props = Object.keys(extraProps).length ? extraProps : null;
  const slots = isSlots(vnode.children) ? vnode.children : {};
  return h(type, props, {
    ...slots,
    default: () => children,
  });
}

/**
 * Rebuilds translated Suspense content with its normalized source root shape.
 *
 * Vue rejects raw primitives inside a slot array, while translations may
 * change a singleton source root into repeated siblings. Use one invisible
 * Fragment for every rebuilt shape so Vue always receives a valid root and
 * keyed source children retain their component identity across locale
 * transitions. When Vue already normalized the source to a Fragment (for
 * example, a multi-node `template v-if`), preserve its render metadata.
 */
function rebuildSuspenseContent(
  children: VNodeChild,
  source?: VNode
): VNodeChild {
  const sourceFragment = source?.type === Fragment ? source : undefined;
  const fragmentChildren =
    children == null ? [] : Array.isArray(children) ? children : [children];
  const fragment = h(Fragment, sourceFragment?.props, fragmentChildren);
  return sourceFragment
    ? copyRenderMetadata(fragment, sourceFragment)
    : fragment;
}

/** Copies render metadata without retaining mounted or normalized child state. */
function copyRenderMetadata(cloned: VNode, source: VNode): VNode {
  cloned.appContext = source.appContext;
  (cloned as VNodeWithRenderMetadata).ctx = (
    source as VNodeWithRenderMetadata
  ).ctx;
  cloned.dirs = source.dirs;
  cloned.ref = source.ref;
  cloned.scopeId = source.scopeId;
  (cloned as VNodeWithRenderMetadata).slotScopeIds = (
    source as VNodeWithRenderMetadata
  ).slotScopeIds;
  cloned.transition = source.transition;
  return cloned;
}

function cloneWithProps(
  vnode: VNode,
  extraProps: Record<string, unknown>
): VNode {
  return cloneVNode(vnode, extraProps);
}

function isVariable(value: JsxElement | Variable): value is Variable {
  return 'k' in value && typeof value.k === 'string';
}
