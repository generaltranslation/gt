import { nodeAt, parsedRange, walk, type ESTree, type Node } from './ast.js';
import {
  append,
  calleeOf,
  calleeRoot,
  positionKey,
  siteOf,
  type CallSite,
  type CalleeRoot,
} from './call-sites.js';
import type { Scope } from './scope.js';

/**
 * Where a module's calls and JSX elements are, by the name of their callee:
 * what the analysis reads of a module that imports a function, without walking
 * the module to find them. Four numbers per site, in the order `walk` visits
 * them: the hash of the callee's name, the kind, and the site's parsed range.
 */
export type SitePositions = Int32Array;

const FIELDS = 4;
const KINDS = ['CallExpression', 'JSXOpeningElement'] as const;
/** The type of a site of each of `KINDS`. */
const SITE_TYPES = ['call', 'jsx'] as const;

/**
 * The positions of the sites whose callee is named by one of `names`: see
 * `calleeRoot`. Undefined if two sites have the same position, which only
 * generated code moved to its source can have: a position would not tell
 * them apart.
 */
export function sitePositions(
  program: ESTree.Program,
  names: ReadonlySet<string>
): SitePositions | undefined {
  const positions: number[] = [];
  /** Kind, start and end of every site, whatever its callee. */
  const everySite: number[] = [];
  let isMoved = false;

  walk(program, {
    enter(node) {
      const kind = KINDS.indexOf(node.type as (typeof KINDS)[number]);
      if (kind === -1) return true;

      const [start, end] = parsedRange(node);
      if (start !== node.start || end !== node.end) isMoved = true;
      everySite.push(kind, start, end);

      const callee =
        node.type === 'CallExpression'
          ? node.callee
          : (node as ESTree.JSXOpeningElement).name;
      const root = calleeRoot(callee as Node);
      if (root && names.has(root.name)) {
        positions.push(nameHash(root.name), kind, start, end);
      }

      return true;
    },
  });

  return isMoved && hasSamePositions(everySite)
    ? undefined
    : Int32Array.from(positions);
}

/** Whether two of the sites, each a kind, a start and an end, have the same position. */
function hasSamePositions(sites: readonly number[]): boolean {
  const keys = new Set<string>();

  for (let at = 0; at < sites.length; at += 3) {
    const key = `${sites[at]}:${sites[at + 1]}:${sites[at + 2]}`;
    if (keys.has(key)) return true;
    keys.add(key);
  }

  return false;
}

/** FNV-1a: names that collide are told apart by the callee itself. */
function nameHash(name: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < name.length; index++) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash | 0;
}

type Positioned = { site: CallSite; root: CalleeRoot };

/**
 * A module's sites, found by `SitePositions` instead of walking the module:
 * each is looked up by its position when it is first asked for. Gives the
 * sites `callSitesIn` indexes, in the same order.
 */
export class PositionedSites {
  /** By `positionKey`: each is looked up once. */
  private readonly sites = new Map<string, CallSite | undefined>();

  constructor(
    private readonly program: ESTree.Program,
    private readonly scope: Scope,
    private readonly positions: SitePositions
  ) {}

  /** As `CallSiteIndex.byDeclaration`, for a callee named `name`. */
  sitesOf(declaration: Node, name: string): CallSite[] {
    return this.named(name)
      .filter(
        ({ root }) =>
          root.member === undefined && this.declarationOf(root) === declaration
      )
      .map(({ site }) => site);
  }

  /** As `CallSiteIndex.byNamespaceMember`, for a namespace named `name`. */
  sitesByMember(namespace: Node, name: string): Map<string, CallSite[]> {
    const byMember = new Map<string, CallSite[]>();
    if (namespace.type !== 'ImportNamespaceSpecifier') return byMember;

    for (const { site, root } of this.named(name)) {
      if (root.member === undefined) continue;
      if (this.declarationOf(root) !== namespace) continue;

      append(byMember, root.member, site);
    }

    return byMember;
  }

  /** As `CallSiteIndex.byPosition`, for a site one of the others gave. */
  at(type: CallSite['type'], start: number, end: number): CallSite | undefined {
    const key = positionKey(type, start, end);
    if (this.sites.has(key)) return this.sites.get(key);

    const kind = KINDS[SITE_TYPES.indexOf(type)]!;
    const node = nodeAt(this.program, kind, start, end);
    const site = node && siteOf(node, this.scope);
    this.sites.set(key, site);

    return site;
  }

  private named(name: string): Positioned[] {
    const hash = nameHash(name);
    const found: Positioned[] = [];

    for (let at = 0; at < this.positions.length; at += FIELDS) {
      if (this.positions[at] !== hash) continue;

      const type = SITE_TYPES[this.positions[at + 1]!]!;
      const start = this.positions[at + 2]!;
      const end = this.positions[at + 3]!;
      const site = this.at(type, start, end);
      const root = site && calleeRoot(calleeOf(site));

      if (root?.name === name) found.push({ site: site!, root });
    }

    return found;
  }

  private declarationOf(root: CalleeRoot): Node | undefined {
    return this.scope.bindingAt(root.identifier)?.declaration;
  }
}
