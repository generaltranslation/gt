import type { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { warnUntrackedMessageTagSync } from '../../../../../console/index.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';
import { formatLocation } from './diagnostics.js';
import { processMessage } from './processMessage.js';
import type { TagOptions } from './types.js';

/** Follows `const gt = useGT()` / `const gt = await getGT()` to the gt binding. */
export function processHookReference(
  hookRef: NodePath,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  const call = hookRef.parentPath;
  if (call?.isTSTypeQuery()) return;
  // An alias, re-export or argument hides the gt it creates.
  if (!call?.isCallExpression() || call.node.callee !== hookRef.node) {
    warnUntrackedTag(hookRef.node, config, output);
    return;
  }
  const declarator = call.parentPath?.isAwaitExpression()
    ? call.parentPath.parentPath
    : call.parentPath;
  const binding =
    declarator?.isVariableDeclarator() && t.isIdentifier(declarator.node.id)
      ? declarator.scope.getBinding(declarator.node.id.name)
      : undefined;
  if (!binding) {
    warnUntrackedTag(call.node, config, output);
    return;
  }
  processTagBinding(binding, undefined, config, output);
}

/**
 * Processes every use of a t/gt binding. `options` is set when the binding is
 * a configured tag, as in `const save = gt({ context })`.
 */
export function processTagBinding(
  binding: Binding,
  options: TagOptions | undefined,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  for (const violation of binding.constantViolations) {
    warnUntrackedTag(violation.node, config, output);
  }
  // Exported declarations count as references, so they warn below.
  for (const ref of binding.referencePaths) {
    processTagReference(ref, options, config, output);
  }
}

function processTagReference(
  ref: NodePath,
  configuredOptions: TagOptions | undefined,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  const parent = ref.parentPath;
  // `typeof gt` in a type has no runtime use.
  if (parent?.isTSTypeQuery()) return;
  if (parent?.isTaggedTemplateExpression() && parent.node.tag === ref.node) {
    // gt`...`
    processMessage(parent, configuredOptions, config, output);
    return;
  }
  if (
    !configuredOptions &&
    parent?.isCallExpression() &&
    parent.node.callee === ref.node
  ) {
    const outer = parent.parentPath;
    if (outer?.isTaggedTemplateExpression() && outer.node.tag === parent.node) {
      // gt({ ...options })`...`
      processMessage(outer, parent.node.arguments, config, output);
      return;
    }
    // const save = gt({ ...options })
    const alias = getConstAliasBinding(outer, parent.node);
    if (alias) {
      processTagBinding(alias, parent.node.arguments, config, output);
      return;
    }
  }
  // const translate = gt
  const alias = getConstAliasBinding(parent, ref.node);
  if (alias) {
    processTagBinding(alias, configuredOptions, config, output);
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

function warnUntrackedTag(
  node: t.Node,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  output.warnings.add(
    warnUntrackedMessageTagSync(config.file, formatLocation(node))
  );
}
