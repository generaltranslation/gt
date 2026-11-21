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
  getConfiguredTagKey,
  unconfiguredTagKey,
  type HelperFollower,
} from './followHelpers.js';
import { parseMessageOptions } from './parseMessageOptions.js';
import { processMessage, reportSkippedMessage } from './processMessage.js';
import { processMsgCall } from './processMsgCall.js';
import { getImportedName } from './imports.js';
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
  /** Bindings being processed, which `var` redeclarations can make cyclic. */
  aliasPath?: ReadonlySet<Binding>;
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
  // await getGT(), useGT() as GT, (await getGT())!
  const created = unwrapTypeExpressions(call, true);
  const declarator = created.parentPath;
  // helper(useGT())
  if (
    declarator &&
    followTagArgument(
      declarator,
      created.node,
      undefined,
      config.file,
      config.file,
      follower,
      () => unconfiguredTagKey
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
  if (context.aliasPath?.has(binding)) return;
  const aliasPath = new Set(context.aliasPath).add(binding);
  for (const violation of binding.constantViolations) {
    warnUntrackedTag(violation.node, config, output);
  }
  // Exported declarations count as references, so they warn below.
  for (const ref of binding.referencePaths) {
    processTagReference(ref, options, { ...context, aliasPath });
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
    // const save = t({ ...options }), const save = t({ ...options })!
    const configured = unwrapTypeExpressions(parent);
    const alias = getAliasBinding(configured.parentPath, configured.node);
    if (alias) {
      // A configured tag is never configured again, so its aliases start a new path.
      processTagBinding(alias, parent.node.arguments, {
        ...context,
        optionsFile: config.file,
        configuredAt: parent.node,
        aliasPath: undefined,
      });
      return;
    }
    // helper(t({ ...options })), helper(t({ ...options })!)
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
  const argument = unwrapTypeExpressions(ref);
  // const translate = t, const translate = t as GT
  const alias = getAliasBinding(argument.parentPath, argument.node);
  if (alias) {
    processTagBinding(alias, configuredOptions, context);
    return;
  }
  // helper(t), helper(t as GT)
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

/** The argument position of each React hook's dependency array. */
const reactHookDependencyPositions: Record<string, number> = {
  useCallback: 1,
  useMemo: 1,
  useEffect: 1,
  useLayoutEffect: 1,
  useInsertionEffect: 1,
  useImperativeHandle: 2,
};

/** The name `react` exports `callee` as: `useMemo`, `R.useMemo` or a renamed import. */
function getReactImportName(callee: NodePath): string | undefined {
  const importOf = (id: NodePath) =>
    id.isIdentifier() ? id.scope.getBinding(id.node.name)?.path : undefined;
  const fromReact = (specifier: NodePath | undefined) =>
    specifier?.parentPath?.isImportDeclaration() &&
    specifier.parentPath.node.source.value === 'react';
  if (callee.isIdentifier()) {
    const specifier = importOf(callee);
    return specifier?.isImportSpecifier() && fromReact(specifier)
      ? getImportedName(specifier.node)
      : undefined;
  }
  if (callee.isMemberExpression() && !callee.node.computed) {
    const specifier = importOf(callee.get('object'));
    const property = callee.node.property;
    return (specifier?.isImportNamespaceSpecifier() ||
      specifier?.isImportDefaultSpecifier() ||
      (specifier?.isImportSpecifier() &&
        getImportedName(specifier.node) === 'default')) &&
      fromReact(specifier) &&
      t.isIdentifier(property)
      ? property.name
      : undefined;
  }
}

/** Whether `path` is listed in a React hook's dependency array. */
function isHookDependency(path: NodePath): boolean {
  const array = path.parentPath;
  const call = array?.parentPath;
  if (!array?.isArrayExpression() || !call?.isCallExpression()) return false;
  const name = getReactImportName(call.get('callee'));
  return (
    name !== undefined &&
    Object.hasOwn(reactHookDependencyPositions, name) &&
    call.node.arguments[reactHookDependencyPositions[name]] === array.node
  );
}

/**
 * Key of the tag `options` configure, or of an unconfigured tag. Invalid
 * options are reported in `file` and give undefined.
 */
function getOptionsKey(
  options: TagOptions | undefined,
  fallback: t.Node,
  file: string,
  { config, output }: TagContext
): string | undefined {
  if (!options) return unconfiguredTagKey;
  try {
    return getConfiguredTagKey(parseMessageOptions(options, fallback));
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

/**
 * The outermost of `node as T`, `node!`, `node satisfies T` and `<T>node`
 * around `path`, and of `await node` too when `awaits` is set.
 */
function unwrapTypeExpressions(path: NodePath, awaits = false): NodePath {
  let current = path;
  for (;;) {
    const parent = current.parentPath;
    const wraps =
      ((parent?.isTSAsExpression() ||
        parent?.isTSNonNullExpression() ||
        parent?.isTSSatisfiesExpression() ||
        parent?.isTSTypeAssertion()) &&
        parent.node.expression === current.node) ||
      (awaits &&
        parent?.isAwaitExpression() &&
        parent.node.argument === current.node);
    if (!wraps || !parent) return current;
    current = parent;
  }
}
