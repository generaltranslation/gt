import {
  buildMessageTree,
  type MessageTree,
  type MessageTreeBranch,
  type MessageTreeHole,
} from '@generaltranslation/icu';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  type Branch,
  getVariableName,
  isAnonymousValue,
  n,
  isPlaceholder,
  PLACEHOLDER,
} from './placeholders';

type BuiltMessage = {
  tree: MessageTree;
  /** Formatting values for every argument in the tree, keyed by name. */
  values: Record<string, unknown>;
};

/** Converts template strings and runtime placeholders into a message tree. */
export function buildMessage(
  strings: readonly string[],
  holes: readonly unknown[]
): BuiltMessage {
  // Null prototype so names like `__proto__` stay own entries.
  const values: Record<string, unknown> = Object.create(null);
  const built = buildMessageTree(
    strings,
    holes.map((hole) => toTreeHole(hole, values))
  );
  for (const [name, value] of built.values) bindValue(values, name, value);
  return { tree: built.tree, values };
}

function toTreeHole(
  hole: unknown,
  values: Record<string, unknown>
): MessageTreeHole {
  if (hole === n) return { kind: 'pound' };
  if (isAnonymousValue(hole)) {
    return {
      kind: 'anonymous',
      value: hole,
    };
  }
  if (!isPlaceholder(hole)) {
    const name = getVariableName(hole);
    bindValue(values, name, (hole as Record<string, unknown>)[name]);
    return { kind: 'argument', name };
  }
  switch (hole[PLACEHOLDER]) {
    case 'fragment':
      return {
        kind: 'fragment',
        strings: hole.strings,
        holes: hole.holes.map((nested) => toTreeHole(nested, values)),
      };
    case 'derive':
      // Derived text is static, so it reads as if written in the template.
      return { kind: 'fragment', strings: [hole.value], holes: [] };
    case 'number':
    case 'date':
      return {
        kind: hole[PLACEHOLDER],
        ...toHoleVariable(hole, values),
        options: hole.options,
      };
    default: {
      const variable = toHoleVariable(hole, values);
      const branches: Record<string, MessageTreeBranch | undefined> =
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
): MessageTreeBranch | undefined {
  if (branch == null || typeof branch === 'string') return branch;
  return {
    strings: branch.strings,
    holes: branch.holes.map((hole) => toTreeHole(hole, values)),
  };
}

function createConflictingPlaceholderError(name: string): string {
  return createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened: `The gt template placeholder "${name}" is bound to different values`,
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
