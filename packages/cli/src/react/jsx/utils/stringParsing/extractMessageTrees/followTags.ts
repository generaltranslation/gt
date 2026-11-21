import type { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  warnStringMessageCallSync,
  warnUntrackedMessageTagSync,
} from '../../../../../console/index.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';
import { loadTypeScript } from '../../typeChecker.js';
import { NonStaticMessageError, formatLocation } from './diagnostics.js';
import {
  followTagArgument,
  getMetadataKey,
  type HelperFollower,
} from './followHelpers.js';
import { parseMessageOptions } from './parseMessageOptions.js';
import { processMessage, reportSkippedMessage } from './processMessage.js';
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
  /** The file a configured tag's options are written in, when not `config.file`. */
  optionsFile?: string;
  /** The `t({ ... })` call that configured the tag, where its options are reported. */
  configuredAt?: t.Node;
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
  // helper(useGT()), helper(useGT() as GT)
  const argument = unwrapTypeExpressions(created);
  if (
    argument.parentPath &&
    followTagArgument(
      argument.parentPath,
      argument.node,
      undefined,
      config.file,
      config.file,
      follower,
      () => getMetadataKey({})
    )
  ) {
    return;
  }
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
      optionsFile: next.optionsFile,
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
  const optionsFile = context.optionsFile ?? config.file;
  const parent = ref.parentPath;
  // `typeof t` in a type has no runtime use.
  if (parent?.isTSTypeQuery()) return;
  if (parent?.isTaggedTemplateExpression() && parent.node.tag === ref.node) {
    // t`...`
    processMessage(parent, configuredOptions, optionsFile, config, output);
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
      processMessage(outer, parent.node.arguments, config.file, config, output);
      return;
    }
    // msg('Save')
    if (isMsg && processMsgCall(parent, config, output)) return;
    // const save = t({ ...options })
    const alias = getAliasBinding(outer, parent.node);
    if (alias) {
      processTagBinding(alias, parent.node.arguments, {
        ...context,
        optionsFile: config.file,
        configuredAt: parent.node,
      });
      return;
    }
    // helper(t({ ...options })), helper(t({ ...options })!)
    const configured = unwrapTypeExpressions(parent);
    if (
      follower &&
      configured.parentPath &&
      followTagArgument(
        configured.parentPath,
        configured.node,
        parent.node.arguments,
        config.file,
        config.file,
        follower,
        () =>
          getOptionsKey(
            parent.node.arguments,
            parent.node,
            config.file,
            context
          )
      )
    ) {
      return;
    }
  }
  // const translate = t
  const alias = getAliasBinding(parent, ref.node);
  if (alias) {
    processTagBinding(alias, configuredOptions, context);
    return;
  }
  // helper(t), helper(t as GT)
  const argument = unwrapTypeExpressions(ref);
  if (
    follower &&
    argument.parentPath &&
    followTagArgument(
      argument.parentPath,
      argument.node,
      configuredOptions,
      optionsFile,
      config.file,
      follower,
      () =>
        getOptionsKey(
          configuredOptions,
          context.configuredAt ?? ref.node,
          optionsFile,
          context
        )
    )
  ) {
    return;
  }
  // useCallback(..., [t]) only lists the tag as a dependency.
  if (isHookDependency(ref)) return;
  warnUntrackedTag(ref.node, config, output);
}

/** Whether `path` is listed in a React hook's dependency array. */
function isHookDependency(path: NodePath): boolean {
  const array = path.parentPath;
  const call = array?.parentPath;
  if (!array?.isArrayExpression() || !call?.isCallExpression()) return false;
  const position = call.node.arguments.indexOf(
    array.node as (typeof call.node.arguments)[number]
  );
  const { callee } = call.node;
  const name = t.isIdentifier(callee)
    ? callee.name
    : t.isMemberExpression(callee) && t.isIdentifier(callee.property)
      ? callee.property.name
      : undefined;
  return position > 0 && !!name && /^use[A-Z]/.test(name);
}

/**
 * Key of the metadata `options` give a message, equal for options written in
 * any order. Invalid options are reported in `file` and give undefined.
 */
function getOptionsKey(
  options: TagOptions | undefined,
  fallback: t.Node,
  file: string,
  { config, output }: TagContext
): string | undefined {
  try {
    return getMetadataKey(parseMessageOptions(options, fallback));
  } catch (error) {
    if (!(error instanceof NonStaticMessageError)) throw error;
    reportSkippedMessage(error, file, config, output);
  }
}

/**
 * Binding of `const alias = <init>` (or `let`/`var`) when `path` is that
 * declarator; processTagBinding warns where the alias is reassigned.
 */
function getAliasBinding(
  path: NodePath | null | undefined,
  init: t.Node
): Binding | undefined {
  if (
    !path?.isVariableDeclarator() ||
    path.node.init !== init ||
    !t.isIdentifier(path.node.id)
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

/** The outermost of `node as T`, `node!` and `node satisfies T` around `path`. */
function unwrapTypeExpressions(path: NodePath): NodePath {
  let current = path;
  while (
    current.parentPath &&
    (current.parentPath.isTSAsExpression() ||
      current.parentPath.isTSNonNullExpression() ||
      current.parentPath.isTSSatisfiesExpression() ||
      current.parentPath.isTSTypeAssertion()) &&
    current.parentPath.node.expression === current.node
  ) {
    current = current.parentPath;
  }
  return current;
}
