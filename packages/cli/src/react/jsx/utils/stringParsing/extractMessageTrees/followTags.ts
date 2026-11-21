import type { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  warnStringMessageCallSync,
  warnUntrackedMessageTagSync,
} from '../../../../../console/index.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';
import { loadTypeScript } from '../../typeChecker.js';
import { formatLocation } from './diagnostics.js';
import { followTagArgument, type HelperFollower } from './followHelpers.js';
import { processMessage } from './processMessage.js';
import { processMsgCall } from './processMsgCall.js';
import type { TagOptions } from './types.js';

/**
 * Where a tag's messages are written to. `follower` is set for a tag that
 * useGT() or getGT() returns, which is followed into the functions it is
 * passed to; `isMsg` also extracts literal calls, as in `msg('Save')`.
 */
export type TagContext = {
  config: ParsingConfig;
  output: ParsingOutput;
  isMsg: boolean;
  follower?: HelperFollower;
};

/** Follows `const t = useGT()` / `const t = await getGT()` to the t binding. */
export function processHookReference(
  hookRef: NodePath,
  config: ParsingConfig,
  output: ParsingOutput,
  follower: HelperFollower
): void {
  const call = hookRef.parentPath;
  if (call?.isTSTypeQuery()) return;
  // An alias, re-export or argument hides the t it creates.
  if (!call?.isCallExpression() || call.node.callee !== hookRef.node) {
    warnUntrackedTag(hookRef.node, config, output);
    return;
  }
  const created = call.parentPath?.isAwaitExpression() ? call.parentPath : call;
  const declarator = created.parentPath;
  // useGT()('Hello')
  if (declarator && warnStringCall(declarator, created.node, config, output)) {
    return;
  }
  const binding =
    declarator?.isVariableDeclarator() && t.isIdentifier(declarator.node.id)
      ? declarator.scope.getBinding(declarator.node.id.name)
      : undefined;
  if (!binding) {
    warnUntrackedTag(call.node, config, output);
    return;
  }
  processTagBinding(binding, undefined, {
    config,
    output,
    isMsg: false,
    follower,
  });
}

/**
 * Extracts the uses of each parameter a tag was passed to, in the order they
 * were found, loading the types of each parameter's file first.
 */
export async function processFollowedParameters(
  config: ParsingConfig,
  output: ParsingOutput,
  follower: HelperFollower
): Promise<void> {
  for (
    let next = follower.pending.shift();
    next;
    next = follower.pending.shift()
  ) {
    await loadTypeScript(next.file);
    processTagBinding(next.binding, next.options, {
      config: { ...config, file: next.file },
      output,
      isMsg: false,
      follower,
    });
  }
}

/**
 * Processes every use of a t/msg binding. `options` is set when the binding
 * is a configured tag, as in `const save = t({ context })`.
 */
export function processTagBinding(
  binding: Binding,
  options: TagOptions | undefined,
  context: TagContext
): void {
  const { config, output } = context;
  for (const violation of binding.constantViolations) {
    warnUntrackedTag(violation.node, config, output);
  }
  // Exported declarations count as references, so they warn below.
  for (const ref of binding.referencePaths) {
    processTagReference(ref, options, context);
  }
}

function processTagReference(
  ref: NodePath,
  configuredOptions: TagOptions | undefined,
  context: TagContext
): void {
  const { config, output, isMsg, follower } = context;
  const parent = ref.parentPath;
  // `typeof t` in a type has no runtime use.
  if (parent?.isTSTypeQuery()) return;
  if (parent?.isTaggedTemplateExpression() && parent.node.tag === ref.node) {
    // t`...`
    processMessage(parent, configuredOptions, config, output);
    return;
  }
  // t('Hello')
  if (!isMsg && parent && warnStringCall(parent, ref.node, config, output)) {
    return;
  }
  if (
    !configuredOptions &&
    parent?.isCallExpression() &&
    parent.node.callee === ref.node
  ) {
    const outer = parent.parentPath;
    if (outer?.isTaggedTemplateExpression() && outer.node.tag === parent.node) {
      // t({ ...options })`...`
      processMessage(outer, parent.node.arguments, config, output);
      return;
    }
    // msg('Save')
    if (isMsg && processMsgCall(parent, config, output)) return;
    // const save = t({ ...options })
    const alias = getConstAliasBinding(outer, parent.node);
    if (alias) {
      processTagBinding(alias, parent.node.arguments, context);
      return;
    }
    // helper(t({ ...options }))
    if (
      follower &&
      outer &&
      followTagArgument(
        outer,
        parent.node,
        parent.node.arguments,
        config.file,
        follower
      )
    ) {
      return;
    }
  }
  // const translate = t
  const alias = getConstAliasBinding(parent, ref.node);
  if (alias) {
    processTagBinding(alias, configuredOptions, context);
    return;
  }
  // helper(t)
  if (
    follower &&
    parent &&
    followTagArgument(
      parent,
      ref.node,
      configuredOptions,
      config.file,
      follower
    )
  ) {
    return;
  }
  warnUntrackedTag(ref.node, config, output);
}

/** Binding of `const alias = <init>` when `path` is that declarator. */
function getConstAliasBinding(
  path: NodePath | null | undefined,
  init: t.Node
): Binding | undefined {
  if (
    !path?.isVariableDeclarator() ||
    path.node.init !== init ||
    !t.isIdentifier(path.node.id) ||
    (path.parentPath as NodePath<t.VariableDeclaration>).node.kind !== 'const'
  ) {
    return;
  }
  return path.scope.getBinding(path.node.id.name);
}

/** Warns when `path` calls `callee`, a translation function, with a string. */
function warnStringCall(
  path: NodePath,
  callee: t.Node,
  config: ParsingConfig,
  output: ParsingOutput
): boolean {
  if (!path.isCallExpression() || path.node.callee !== callee) return false;
  const [message] = path.node.arguments;
  if (!t.isStringLiteral(message) && !t.isTemplateLiteral(message)) {
    return false;
  }
  output.warnings.add(
    warnStringMessageCallSync(config.file, formatLocation(path.node))
  );
  return true;
}

function warnUntrackedTag(
  node: t.Node,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  output.warnings.add(
    warnUntrackedMessageTagSync(config.file, formatLocation(node))
  );
}
