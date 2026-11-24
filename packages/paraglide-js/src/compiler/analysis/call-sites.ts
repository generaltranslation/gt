import {
  parsedRange,
  staticString,
  unwrapExpression,
  walk,
  type ESTree,
  type Node,
} from './ast.js';
import { evaluateAll, layeredNamespace, type Layer } from './evaluate.js';
import type { Scope } from './scope.js';
import type { TrackedSymbol } from './types.js';

/** What a binding may hold: an expression's values, or computed ones. */
export type Candidate =
  | { type: 'expression'; node: Node; scope: Scope; path: readonly string[] }
  | { type: 'computed'; get: () => TrackedSymbol[] };

/** A call of a function, or a JSX element of a component. */
export type CallSite =
  | { type: 'call'; node: Node; arguments: readonly Node[]; scope: Scope }
  | { type: 'jsx'; element: ESTree.JSXOpeningElement; scope: Scope };

/**
 * A call site as the analysis keeps it. One in another module than the callee
 * is `imported`, and found again when it is read: holding it would hold that
 * whole module, and a function can be called from thousands.
 */
export type SiteHandle = {
  type: CallSite['type'];
  imported: boolean;
  resolve(): CallSite | undefined;
};

export type CallSiteIndex = {
  /** By the node that declares the callee: a function, or an import specifier. */
  byDeclaration: Map<Node, CallSite[]>;
  /** `ns.f(…)` and `<ns.F />`: by the namespace import specifier, then by member name. */
  byNamespaceMember: Map<Node, Map<string, CallSite[]>>;
  /** By `sitePosition`. */
  byPosition: Map<string, CallSite>;
};

export type InstantiationSyntax = 'new' | 'call';

type Call = Extract<CallSite, { type: 'call' }>;
type JsxElement = Extract<CallSite, { type: 'jsx' }>;

const MAX_COMPONENT_ALIASES = 8;

const indexes = new WeakMap<Scope, Map<string, CallSiteIndex>>();

export function callSitesIn(
  program: ESTree.Program,
  moduleScope: Scope
): CallSiteIndex {
  return indexOnce(moduleScope, 'call-sites', (index) => {
    walk(program, {
      enter(node) {
        if (node.type === 'CallExpression') {
          const site: Call = {
            type: 'call',
            node,
            arguments: node.arguments,
            scope: moduleScope,
          };
          addSite(index, node.callee, site);
        }

        if (node.type === 'JSXOpeningElement') {
          const site: JsxElement = {
            type: 'jsx',
            element: node,
            scope: moduleScope,
          };
          addSite(index, node.name as Node, site);
        }

        return true;
      },
    });
  });
}

/** The components a language tool's generated code renders with `new C(props)` or `C(props)`. */
export function componentInstancesIn(
  program: ESTree.Program,
  moduleScope: Scope,
  syntax: InstantiationSyntax
): CallSiteIndex {
  const instantiation = syntax === 'new' ? 'NewExpression' : 'CallExpression';

  return indexOnce(moduleScope, `${syntax}-instances`, (index) => {
    walk(program, {
      enter(node) {
        if (node.type !== instantiation) return true;

        const component = instantiatedComponent(node.callee, moduleScope);
        const site: Call = {
          type: 'call',
          node,
          arguments: node.arguments,
          scope: moduleScope,
        };
        if (component) addSite(index, component, site);

        return true;
      },
    });
  });
}

/** Where a site is in its module, the same once the module is parsed again. */
export function sitePosition(site: CallSite): string {
  const [start, end] = parsedRange(
    site.type === 'call' ? site.node : site.element
  );

  return `${site.type}:${start}:${end}`;
}

/** A handle on a site of the module being read, which holds it already. */
export function ownSite(site: CallSite): SiteHandle {
  return { type: site.type, imported: false, resolve: () => site };
}

/** What a call site passes as parameter `index`; a JSX element passes its props as the first. */
export function argumentOf(
  handle: SiteHandle,
  index: number
): Candidate | undefined {
  if (handle.type === 'jsx') {
    return index === 0 ? propsArgument(handle) : undefined;
  }

  if (!handle.imported) {
    const site = handle.resolve();
    return site?.type === 'call' ? callArgument(site, index) : undefined;
  }

  // Computed keys do not follow another module's literals: `show(404)` leaves `` m[`error_${code}`] `` at error_*.
  return {
    type: 'computed',
    get: () => {
      const site = handle.resolve();
      const argument =
        site?.type === 'call' ? passedArgument(site, index) : undefined;

      return argument ? evaluateAll(argument, site!.scope) : [];
    },
  };
}

/**
 * Whether a call site leaves parameter `index` to its default: it passes
 * nothing there, or `undefined`. A JSX element passes only its props.
 */
export function omitsArgument(handle: SiteHandle, index: number): boolean {
  if (handle.type === 'jsx') return index > 0;

  const site = handle.resolve();
  if (site?.type !== 'call') return false;

  // After a spread, what is passed where is unknown.
  const upToIndex = site.arguments.slice(0, index + 1);
  if (upToIndex.some((argument) => argument.type === 'SpreadElement'))
    return false;

  const argument = site.arguments[index];

  return argument === undefined || isUndefined(argument, site.scope);
}

function indexOnce(
  moduleScope: Scope,
  kind: string,
  fill: (index: CallSiteIndex) => void
): CallSiteIndex {
  let indexesOfScope = indexes.get(moduleScope);

  if (!indexesOfScope) {
    indexesOfScope = new Map();
    indexes.set(moduleScope, indexesOfScope);
  }

  let index = indexesOfScope.get(kind);

  if (!index) {
    index = {
      byDeclaration: new Map(),
      byNamespaceMember: new Map(),
      byPosition: new Map(),
    };
    indexesOfScope.set(kind, index);
    fill(index);
  }

  return index;
}

function addSite(index: CallSiteIndex, callee: Node, site: CallSite): void {
  const node = unwrapExpression(callee);

  if (node.type === 'Identifier' || node.type === 'JSXIdentifier') {
    const declaration = site.scope.bindingAt(node)?.declaration;
    if (!declaration) return;

    append(index.byDeclaration, declaration, site);
    index.byPosition.set(sitePosition(site), site);
    return;
  }

  if (node.type !== 'MemberExpression' && node.type !== 'JSXMemberExpression')
    return;

  const member = calleeMemberName(node);
  if (member === undefined) return;

  const object = unwrapExpression(node.object as Node);
  if (object.type !== 'Identifier' && object.type !== 'JSXIdentifier') return;

  const namespace = site.scope.bindingAt(object)?.declaration;
  if (namespace?.type !== 'ImportNamespaceSpecifier') return;

  let sitesByMember = index.byNamespaceMember.get(namespace);

  if (!sitesByMember) {
    sitesByMember = new Map();
    index.byNamespaceMember.set(namespace, sitesByMember);
  }

  append(sitesByMember, member, site);
  index.byPosition.set(sitePosition(site), site);
}

function calleeMemberName(
  member: ESTree.MemberExpression | ESTree.JSXMemberExpression
): string | undefined {
  if (member.type === 'JSXMemberExpression') return member.property.name;
  if (member.computed) return staticString(member.property);

  return member.property.type === 'Identifier'
    ? member.property.name
    : undefined;
}

function append<K>(map: Map<K, CallSite[]>, key: K, site: CallSite): void {
  const sites = map.get(key);

  if (sites) sites.push(site);
  else map.set(key, [site]);
}

/**
 * Generated code wraps and aliases the component it instantiates:
 * `const $$C = __sveltets_2_ensureComponent(Label)` (Svelte),
 * `const C = Label || Label` (Vue, for the opening and the closing tag).
 */
function instantiatedComponent(
  expression: Node,
  scope: Scope,
  depth = 0
): Node | undefined {
  if (depth > MAX_COMPONENT_ALIASES) return undefined;

  const node = unwrapExpression(expression);

  if (node.type === 'CallExpression') {
    const wrapped = node.arguments[0];
    return wrapped && instantiatedComponent(wrapped, scope, depth + 1);
  }

  if (node.type === 'LogicalExpression') {
    return instantiatedComponent(node.left, scope, depth + 1);
  }

  if (node.type !== 'Identifier') return node;

  const binding = scope.bindingAt(node);
  const isLocalAlias =
    binding?.type === 'alias' &&
    binding.path.length === 0 &&
    binding.scope === scope;

  return isLocalAlias
    ? instantiatedComponent(binding.init, scope, depth + 1)
    : node;
}

/** `undefined` and `void 0` */
function isUndefined(expression: Node, scope: Scope): boolean {
  const node = unwrapExpression(expression);

  if (node.type === 'UnaryExpression') return node.operator === 'void';

  return (
    node.type === 'Identifier' &&
    node.name === 'undefined' &&
    scope.isGlobal(node)
  );
}

function callArgument(site: Call, index: number): Candidate | undefined {
  const argument = passedArgument(site, index);

  return (
    argument && {
      type: 'expression',
      node: argument,
      scope: site.scope,
      path: [],
    }
  );
}

/** The argument at `index`; undefined if there is none, or a spread may move it. */
function passedArgument(site: Call, index: number): Node | undefined {
  const argument = site.arguments[index];
  if (!argument || argument.type === 'SpreadElement') return undefined;

  // A spread before it shifts the positions.
  const earlierArguments = site.arguments.slice(0, index);
  if (earlierArguments.some((earlier) => earlier.type === 'SpreadElement'))
    return undefined;

  return argument;
}

function propsArgument(handle: SiteHandle): Candidate {
  return {
    type: 'computed',
    get: () => {
      const site = handle.resolve();
      if (site?.type !== 'jsx') return [];

      const { element, scope } = site;
      return [
        layeredNamespace(
          () => element.attributes.flatMap(attributeLayer),
          scope
        ),
      ];
    },
  };
}

function attributeLayer(attribute: ESTree.JSXAttributeItem): Layer[] {
  if (attribute.type === 'JSXSpreadAttribute')
    return [{ spread: attribute.argument }];

  const { name, value } = attribute;
  const holdsExpression =
    value?.type === 'JSXExpressionContainer' &&
    value.expression.type !== 'JSXEmptyExpression';
  if (name.type !== 'JSXIdentifier' || !holdsExpression) return [];

  return [{ name: name.name, value: value.expression }];
}
