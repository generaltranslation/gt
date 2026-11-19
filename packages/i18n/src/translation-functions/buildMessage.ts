import type { MessageTree, MessageFormats } from '@generaltranslation/icu';
import {
  templateToMessage,
  type TemplateBranch,
  type TemplateHole,
} from '@generaltranslation/icu/internal';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  type Branch,
  getVariable,
  isAnonymousValue,
  n,
  isPlaceholder,
  PLACEHOLDER,
} from './placeholders';
import { hashMessageTree, type MessageTreeMetadata } from './renderMessage';

type BuiltMessage = {
  tree: MessageTree;
  /** Formatting values for every argument in the tree, keyed by name. */
  values: Record<string, unknown>;
  /** Formatting context of each formatted argument, keyed by name. */
  formats: MessageFormats;
};

/** Converts template strings and runtime placeholders into a message tree. */
export function buildMessage(
  strings: readonly string[],
  holes: readonly unknown[]
): BuiltMessage {
  // Null prototype so names like `__proto__` stay own entries.
  const values: Record<string, unknown> = Object.create(null);
  const built = templateToMessage(
    strings,
    holes.map((hole) => toTreeHole(hole, values))
  );
  for (const [name, value] of built.values) bindValue(values, name, value);
  return { tree: built.tree, values, formats: built.formats };
}

/** What a call site keeps between renders. */
type Site = {
  tree: MessageTree;
  formats: MessageFormats;
  /** The variable each hole binds, and whether the hole names it. */
  slots: { name: string; named: boolean }[];
  /** The metadata the tree was last hashed with, with that hash. */
  hashed?: MessageTreeMetadata & { $_hash: string };
};

// A tagged template's strings are one array per call site.
const sites = new WeakMap<readonly string[], Site>();

const NO_VALUES: Record<string, unknown> = Object.freeze(Object.create(null));

/**
 * Like buildMessage, for a call site that renders again and again. While
 * every hole is a value, the tree depends only on the holes' names, so the
 * site's tree and hash are reused and only the values are bound. The metadata
 * is returned with that hash unless it has a `$_hash`.
 */
export function buildSiteMessage(
  strings: readonly string[],
  holes: readonly unknown[],
  metadata: MessageTreeMetadata
): BuiltMessage & { metadata: MessageTreeMetadata } {
  let site = sites.get(strings);
  let values = site && bindSlots(site.slots, holes);
  if (!site || !values) {
    const built = buildMessage(strings, holes);
    const slots = toSlots(built.tree, holes);
    if (!slots) return { ...built, metadata };
    ({ values } = built);
    site = { tree: built.tree, formats: built.formats, slots };
    sites.set(strings, site);
  }
  return {
    tree: site.tree,
    values,
    formats: site.formats,
    metadata: withSiteHash(site, metadata),
  };
}

/** The values of a site's holes, or undefined when a hole changed its name. */
function bindSlots(
  slots: Site['slots'],
  holes: readonly unknown[]
): Record<string, unknown> | undefined {
  if (slots.length !== holes.length) return undefined;
  if (slots.length === 0) return NO_VALUES;
  // Null prototype so names like `__proto__` stay own entries.
  const values: Record<string, unknown> = Object.create(null);
  for (let i = 0; i < slots.length; i++) {
    const hole = holes[i];
    const { name, named } = slots[i];
    if (hole === n) return undefined;
    if (isAnonymousValue(hole)) {
      if (named) return undefined;
      values[name] = hole;
      continue;
    }
    const keys = Object.keys(hole as object);
    if (
      !named ||
      isPlaceholder(hole) ||
      keys.length !== 1 ||
      keys[0] !== name
    ) {
      return undefined;
    }
    bindValue(values, name, (hole as Record<string, unknown>)[name]);
  }
  return values;
}

/** The slots of a built template whose holes are all values. */
function toSlots(
  tree: MessageTree,
  holes: readonly unknown[]
): Site['slots'] | undefined {
  // shortcut: a template with a helper, like plural(), is built on every
  // render; key it by the shape of its holes when a profile shows one hot.
  if (holes.some(isPlaceholder)) return undefined;
  // Such a tree is text and one argument per hole, in the holes' order.
  const names =
    typeof tree === 'string'
      ? []
      : tree.flatMap((node) => (typeof node === 'object' ? [node[0]] : []));
  return holes.map((hole, i) => ({
    name: names[i],
    named: !isAnonymousValue(hole),
  }));
}

function withSiteHash(
  site: Site,
  metadata: MessageTreeMetadata
): MessageTreeMetadata {
  if (metadata.$_hash !== undefined) return metadata;
  const { context, maxChars, requiresReview } = metadata;
  const { hashed } = site;
  if (
    hashed &&
    hashed.context === context &&
    hashed.maxChars === maxChars &&
    hashed.requiresReview === requiresReview
  ) {
    return hashed;
  }
  return (site.hashed = {
    context,
    maxChars,
    requiresReview,
    $_hash: hashMessageTree(site.tree, metadata),
  });
}

function toTreeHole(
  hole: unknown,
  values: Record<string, unknown>
): TemplateHole {
  if (hole === n) return { kind: 'pound' };
  if (isAnonymousValue(hole)) {
    return {
      kind: 'anonymous',
      value: hole,
    };
  }
  if (!isPlaceholder(hole)) {
    const [name, value] = getVariable(hole);
    bindValue(values, name, value);
    return { kind: 'argument', name };
  }
  switch (hole[PLACEHOLDER]) {
    case 'fragment':
      return {
        kind: 'fragment',
        strings: hole.strings,
        holes: hole.holes.map((nested) => toTreeHole(nested, values)),
      };
    // dyn() text joins the message like derive() text; tx translates it in context.
    case 'dyn':
    case 'derive':
      // Derived text is static, so it reads as if written in the template.
      return { kind: 'fragment', strings: [hole.value], holes: [] };
    case 'number':
      return {
        kind: 'number',
        ...toHoleVariable(hole, values),
        options: hole.options,
      };
    case 'date':
    case 'time':
      return {
        kind: hole[PLACEHOLDER],
        ...toHoleVariable(hole, values),
        options: hole.options,
      };
    default: {
      const variable = toHoleVariable(hole, values);
      const branches: Record<string, TemplateBranch | undefined> =
        Object.create(null);
      for (const [key, branch] of Object.entries(hole.branches)) {
        branches[key] = toTreeBranch(branch, values);
      }
      return { kind: hole[PLACEHOLDER], ...variable, branches };
    }
  }
}

// A named value is bound here; the builder numbers an unnamed one as `_gt_N`.
function toHoleVariable(
  hole: { name: string | undefined; value: unknown },
  values: Record<string, unknown>
): { name: string } | { value: unknown } {
  if (hole.name === undefined) return { value: hole.value };
  bindValue(values, hole.name, hole.value);
  return { name: hole.name };
}

function toTreeBranch(
  branch: Branch | undefined,
  values: Record<string, unknown>
): TemplateBranch | undefined {
  if (branch == null || typeof branch === 'string') return branch;
  return {
    strings: branch.strings,
    holes: branch.holes.map((hole) => toTreeHole(hole, values)),
  };
}

function createConflictingPlaceholderError(name: string): string {
  return createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened: `The t template placeholder "${name}" is bound to different values`,
    fix: 'Give each distinct value its own placeholder name',
  });
}

// One name is one ICU argument, so it can only carry one value per message.
function bindValue(
  values: Record<string, unknown>,
  name: string,
  value: unknown
): void {
  if (name in values && !Object.is(values[name], value)) {
    throw new Error(createConflictingPlaceholderError(name));
  }
  values[name] = value;
}
