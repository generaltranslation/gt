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
  Text,
  cloneVNode,
  h,
  isVNode,
  mergeProps,
  type Component,
  type Slot,
  type Slots,
  type VNode,
  type VNodeChild,
} from 'vue';
import { isBranchAttribute } from '../components/utils';
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
  opaque: boolean;
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

type VNodeWithRenderMetadata = VNode & {
  ctx?: unknown;
  slotScopeIds?: string[] | null;
};

export function translateVueChildren(
  children: VNode[],
  state: GTState,
  options: RichTranslationOptions
): VNodeChild {
  const source = createSourceNodes(children);
  if (state.locale.value === state.defaultLocale) {
    return renderDefaultNodes(source, state, state.defaultLocale);
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
    return renderDefaultNodes(source, state, state.defaultLocale);
  }
  return renderNodes(source, target, state);
}

function createSourceNodes(children: unknown): SourceNode[] {
  const index = { value: 0 };
  return visitChildren(children, index);
}

function visitChildren(
  children: unknown,
  index: { value: number }
): SourceNode[] {
  if (Array.isArray(children)) {
    return mergeAdjacentStrings(
      children.flatMap((child) => visitChildren(child, index))
    );
  }
  if (children == null || typeof children === 'boolean') return [];
  if (!isVNode(children)) return [String(children)];
  if (children.type === Comment) return [];
  if (children.type === Text) return [String(children.children ?? '')];
  if (children.type === Fragment) {
    return visitChildren(children.children, index);
  }

  index.value += 1;
  const id = index.value;
  const metadata = getGTMetadata(children);
  const transformation = getTransformation(metadata);
  const variable =
    transformation === 'variable' ? getVariable(metadata, id) : undefined;
  const defaultSlot = variable
    ? { children: undefined, opaque: false }
    : readDefaultSlot(children);
  const source: SourceElement = {
    branches: {},
    children:
      variable || defaultSlot.opaque
        ? []
        : visitChildren(defaultSlot.children, index),
    id,
    opaque: defaultSlot.opaque,
    transformation,
    variableName: variable?.name,
    variableType: variable?.type,
    vnode: children,
  };

  if (transformation === 'branch' || transformation === 'plural') {
    source.branches = getBranches(children, transformation, id);
  }
  return [source];
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

const SCOPED_SLOT_ACCESS = Symbol('gt-vue scoped slot access');

/**
 * Reads a default slot only while it behaves like source-owned static content.
 *
 * Vue's compiled scoped-slot wrappers erase the original function arity, so
 * they cannot be identified from `slot.length`. A throwing proxy detects the
 * first read of slot props without inventing runtime values. Such slots stay
 * opaque and are later rendered by their owning component with real props.
 */
function readDefaultSlot(vnode: VNode): {
  children: unknown;
  opaque: boolean;
} {
  if (!isSlots(vnode.children)) {
    return { children: vnode.children, opaque: false };
  }
  return readSlot(vnode.children.default);
}

/** Safely probes one compiled slot without supplying invented slot props. */
function readSlot(slot?: Slot): { children: unknown; opaque: boolean } {
  if (!slot) return { children: undefined, opaque: false };

  const access = { detected: false };
  const detectAccess = () => {
    access.detected = true;
    throw SCOPED_SLOT_ACCESS;
  };
  const probe = new Proxy(Object.create(null) as object, {
    get: detectAccess,
    getOwnPropertyDescriptor: detectAccess,
    getPrototypeOf: detectAccess,
    has: detectAccess,
    ownKeys: detectAccess,
  });

  try {
    const slotChildren = slot(probe);
    return access.detected
      ? { children: undefined, opaque: true }
      : { children: slotChildren, opaque: false };
  } catch (error) {
    if (access.detected || error === SCOPED_SLOT_ACCESS) {
      return { children: undefined, opaque: true };
    }
    throw error;
  }
}

function getBranches(
  vnode: VNode,
  transformation: 'branch' | 'plural',
  branchElementId: number
): Record<string, SourceNode[]> {
  const inputs = Object.create(null) as Record<string, unknown>;
  if (isSlots(vnode.children)) {
    for (const [key, slot] of Object.entries(vnode.children)) {
      if (
        key !== 'default' &&
        !key.startsWith('_') &&
        typeof slot === 'function'
      ) {
        const branch = readSlot(slot);
        if (!branch.opaque) inputs[key] = branch.children;
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
        visitChildren(value, { value: branchElementId }),
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
  state: GTState
): VNodeChild {
  if (target == null) {
    // A partial translated tree falls back within the active locale. A wholly
    // missing catalog entry is handled above using the source/default locale.
    return renderDefaultNodes(source, state, state.locale.value);
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

  return targets.map((targetNode) => {
    if (typeof targetNode === 'string') return targetNode;
    if (isVariable(targetNode)) {
      const variable = variables.get(targetNode.k);
      return variable ? renderDefaultNode(variable, state) : null;
    }

    // An explicit target ID is a reusable reference, while order-based
    // fallback consumes each source node once. Translations may intentionally
    // repeat one source element without rebinding later copies to siblings.
    const sourceNode =
      (targetNode.i == null ? undefined : ordinaryById.get(targetNode.i)) ??
      fallback.shift();
    return sourceNode ? renderElement(sourceNode, targetNode, state) : null;
  });
}

function renderElement(
  source: SourceElement,
  target: JsxElement,
  state: GTState
): VNodeChild {
  if (source.transformation === 'branch') {
    const branch = getBranchKey(source.vnode);
    return renderNodes(
      getSelectedSourceBranch(source, branch),
      getSelectedTargetBranch(target, branch),
      state
    );
  }
  if (source.transformation === 'plural') {
    const n = source.vnode.props?.n;
    if (typeof n !== 'number') return renderDefaultNode(source, state);
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
      state
    );
  }
  if (source.transformation === 'fragment') {
    return renderNodes(source.children, target.c, state);
  }
  if (source.opaque) {
    const translatedProps = getTranslatedProps(target);
    return Object.keys(translatedProps).length
      ? cloneWithProps(source.vnode, translatedProps)
      : source.vnode;
  }
  const translatedProps = getTranslatedProps(target);
  if (target.c == null) {
    return Object.keys(translatedProps).length
      ? cloneWithProps(source.vnode, translatedProps)
      : renderDefaultNode(source, state);
  }

  return cloneWithChildren(
    source.vnode,
    renderNodes(source.children, target.c, state),
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
    getPluralForm(n, forms, [...sourceLocales, locale, state.defaultLocale]) ||
    undefined
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
  locale = state.defaultLocale
): VNodeChild[] {
  return nodes.map((node) => renderDefaultNode(node, state, locale));
}

function renderDefaultNode(
  node: SourceNode,
  state: GTState,
  locale?: string
): VNodeChild {
  if (typeof node === 'string') return node;
  if (node.transformation === 'variable') {
    return locale && node.variableType !== 'v'
      ? cloneWithProps(node.vnode, {
          locales: [
            ...(Array.isArray(node.vnode.props?.locales)
              ? node.vnode.props.locales
              : []),
            locale,
          ],
        })
      : node.vnode;
  }
  if (node.transformation === 'fragment') {
    return renderDefaultNodes(node.children, state, locale);
  }
  if (node.transformation === 'branch') {
    return renderDefaultNodes(
      getSelectedSourceBranch(node, getBranchKey(node.vnode)),
      state,
      locale
    );
  }
  if (node.transformation === 'plural') {
    const n = node.vnode.props?.n;
    if (typeof n !== 'number') {
      return renderDefaultNodes(node.children, state, locale);
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
      locale
    );
  }
  if (!node.children.length) return node.vnode;
  return cloneWithChildren(
    node.vnode,
    renderDefaultNodes(node.children, state, locale)
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
    cloned.appContext = vnode.appContext;
    (cloned as VNodeWithRenderMetadata).ctx = (
      vnode as VNodeWithRenderMetadata
    ).ctx;
    cloned.dirs = vnode.dirs;
    cloned.ref = vnode.ref;
    cloned.scopeId = vnode.scopeId;
    (cloned as VNodeWithRenderMetadata).slotScopeIds = (
      vnode as VNodeWithRenderMetadata
    ).slotScopeIds;
    cloned.transition = vnode.transition;
    return cloned;
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

function cloneWithProps(
  vnode: VNode,
  extraProps: Record<string, unknown>
): VNode {
  return cloneVNode(vnode, extraProps);
}

function isVariable(value: JsxElement | Variable): value is Variable {
  return 'k' in value && typeof value.k === 'string';
}
