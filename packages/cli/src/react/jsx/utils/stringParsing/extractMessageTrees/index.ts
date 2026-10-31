import traverseModule from '@babel/traverse';
import type { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  buildMessageTree,
  findConflictingFormat,
  type MessageTreeBranch,
  type MessageTreeFragment,
  type MessageTreeHole,
} from '@generaltranslation/icu';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { randomUUID } from 'node:crypto';
import {
  warnConflictingMessageVariableFormatsSync,
  warnIgnoredProtoPropertySync,
  warnNonStaticMessageTreeSync,
  warnUnfollowedUnstableImportSync,
  warnUntrackedMessageTagSync,
} from '../../../../../console/index.js';
import {
  GT_LIBRARIES,
  isLegacyGTImportSource,
  type GTLibrary,
} from '../../../../../types/libraries.js';
import {
  DERIVE_FUNCTION,
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  T_REGISTRATION_FUNCTION,
} from '../../constants.js';
import {
  getStringVariants,
  loadTypeScript,
  isPlainValue,
  type TypeIssue,
} from '../../typeChecker.js';
import { extractStringEntryMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

// The compiler mirrors this walker without derive() in
// packages/compiler/src/transform/injection/injectUnstableTaggedTemplateHash.ts;
// test-fixtures/icu-tree-wire-format.json keeps both on the same hashes.

const PART_FUNCTION = 'part';
const PLURAL_COUNT_CONSTANT = 'n';

/** Each variant is uploaded as its own entry, so larger messages are skipped. */
const MAX_MESSAGE_VARIANTS = 1000;

const USE_UNSTABLE_HELPERS_FIX =
  'Import derive() from the same unstable entry as t, useGT, or getGT';

/** Thrown when a message cannot be extracted statically; the message is skipped. */
class NonStaticMessageError extends Error {
  constructor(
    reason: string,
    readonly node: t.Node,
    readonly details?: string,
    readonly fix?: string
  ) {
    super(reason);
  }
}

type TreeContext = {
  /** Path whose scope resolves identifiers in the current template. */
  scopePath: NodePath;
  config: ParsingConfig;
  output: ParsingOutput;
  usesDerive: boolean;
  resolvingParts: Set<t.Node>;
};

/**
 * Extracts tagged-template messages written with the unstable `t`, `useGT()`,
 * and `getGT()` APIs as message tree updates (`dataFormat: 'ICU_TREE'`).
 *
 * Supports t`...`, t({ ...options })`...`, and the same forms on a
 * `const gt = useGT()` / `const gt = await getGT()` result, including const
 * aliases (`const tr = gt`) and configured tags (`const save = gt({ ... })`).
 * Messages that are not statically analyzable are skipped with a warning, and
 * so are uses of a tag that cannot be followed.
 */
export async function extractMessageTrees(
  ast: t.File,
  pkgs: readonly GTLibrary[],
  config: ParsingConfig,
  output: ParsingOutput
): Promise<void> {
  const isExtractedSource = (source: string) =>
    isUnstableGTImportSource(source) &&
    pkgs.some((pkg) => source.startsWith(`${pkg}/`));
  // Only messages from an imported tag read types, so only those files load
  // TypeScript.
  if (
    ast.program.body.some(
      (node) =>
        t.isImportDeclaration(node) && isExtractedSource(node.source.value)
    )
  ) {
    await loadTypeScript(config.file);
  }
  const warnUnfollowed = (source: string, node: t.Node) =>
    output.warnings.add(
      warnUnfollowedUnstableImportSync(
        config.file,
        source,
        formatLocation(node)
      )
    );
  traverse(ast, {
    // require('gt-react/unstable') and import('gt-react/unstable')
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      const isLoader =
        t.isImport(callee) ||
        (t.isIdentifier(callee, { name: 'require' }) &&
          !path.scope.hasBinding('require'));
      const [source] = args;
      if (!isLoader || !t.isStringLiteral(source)) return;
      if (!isExtractedSource(source.value)) return;
      warnUnfollowed(source.value, path.node);
    },
    // export { t } from 'gt-react/unstable' and export * from 'gt-react/unstable'
    'ExportNamedDeclaration|ExportAllDeclaration'(path) {
      const node = path.node as
        | t.ExportNamedDeclaration
        | t.ExportAllDeclaration;
      if (!node.source || !isExtractedSource(node.source.value)) return;
      const typeOnly =
        node.exportKind === 'type' ||
        (t.isExportNamedDeclaration(node) &&
          node.specifiers.every(
            (specifier) =>
              t.isExportSpecifier(specifier) && specifier.exportKind === 'type'
          ));
      if (!typeOnly) warnUnfollowed(node.source.value, node);
    },
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (!isExtractedSource(source)) return;
      for (const specifier of path.node.specifiers) {
        if (
          t.isImportNamespaceSpecifier(specifier) &&
          path.node.importKind !== 'type'
        ) {
          warnUnfollowed(source, specifier);
          continue;
        }
        if (!t.isImportSpecifier(specifier)) continue;
        const importedName = getImportedName(specifier);
        const binding = path.scope.getBinding(specifier.local.name);
        if (!binding) continue;
        if (importedName === T_REGISTRATION_FUNCTION) {
          processTagBinding(binding, undefined, config, output);
        } else if (
          importedName === INLINE_TRANSLATION_HOOK ||
          importedName === INLINE_TRANSLATION_HOOK_ASYNC
        ) {
          for (const ref of binding.referencePaths) {
            processHookReference(ref, config, output);
          }
        }
      }
    },
  });
}

type TagOptions = t.CallExpression['arguments'];

/** Follows `const gt = useGT()` / `const gt = await getGT()` to the gt binding. */
function processHookReference(
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
function processTagBinding(
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

function processMessage(
  tagged: NodePath<t.TaggedTemplateExpression>,
  options: TagOptions | undefined,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  const context: TreeContext = {
    scopePath: tagged,
    config,
    output,
    usesDerive: false,
    resolvingParts: new Set(),
  };
  try {
    const hashMetadata = parseMessageOptions(options, tagged.node);
    const variants = templateVariants(tagged.node.quasi, context);
    const metadata = {
      ...extractStringEntryMetadata({
        output,
        config,
        nodeLoc: tagged.node.loc,
      }),
      ...hashMetadata,
      ...(context.usesDerive && {
        staticId: `derive-temp-id-${randomUUID()}`,
      }),
    };
    // Build every tree first so a failing variant skips the whole message.
    const trees = variants.map(({ strings, holes }) => {
      try {
        return buildMessageTree(strings, holes).tree;
      } catch (error) {
        // The builder rejects variable names that use its reserved prefix
        throw new NonStaticMessageError(
          'the message tree could not be built',
          tagged.node,
          formatDiagnosticErrorDetails(error)
        );
      }
    });
    for (const tree of trees) {
      const conflict = findConflictingFormat(tree);
      if (conflict === undefined) continue;
      output.warnings.add(
        warnConflictingMessageVariableFormatsSync(
          config.file,
          conflict,
          formatLocation(tagged.node)
        )
      );
      return;
    }
    for (const tree of trees) {
      output.updates.push({
        dataFormat: 'ICU_TREE',
        source: tree,
        // Each variant gets its own hash, so it needs its own metadata object.
        metadata: { ...metadata },
      });
    }
  } catch (error) {
    if (!(error instanceof NonStaticMessageError)) throw error;
    output.warnings.add(
      warnNonStaticMessageTreeSync(
        config.file,
        error.message,
        formatLocation(error.node),
        error.details,
        error.fix
      )
    );
  }
}

// ===== Options ===== //

function parseMessageOptions(
  args: t.CallExpression['arguments'] | undefined,
  tagged: t.Node
): MessageTreeHashMetadata {
  if (!args) return {};
  const [options] = args;
  if (args.length !== 1 || !t.isObjectExpression(options)) {
    throw new NonStaticMessageError(
      'the gt() options are not a single object literal',
      options ?? tagged
    );
  }
  const metadata: MessageTreeHashMetadata = {};
  for (const property of options.properties) {
    const key = getPropertyKey(property);
    const value = (property as t.ObjectProperty).value;
    if (key === 'context') {
      metadata.context = getStaticText(value, 'the context option');
    } else if (key === 'maxChars') {
      const maxChars = getNumber(value);
      if (maxChars == null || !Number.isInteger(maxChars)) {
        throw new NonStaticMessageError(
          'the maxChars option is not an integer literal',
          value
        );
      }
      // The sign never changes the hash; store the limit like other entries.
      metadata.maxChars = Math.abs(maxChars);
    } else if (key === 'requiresReview') {
      if (!t.isBooleanLiteral(value)) {
        throw new NonStaticMessageError(
          'the requiresReview option is not a boolean literal',
          value
        );
      }
      metadata.requiresReview = value.value;
    } else if (key !== 'locale') {
      // `locale` only picks the render locale; any other key is unsupported.
      throw new NonStaticMessageError(
        `the gt() option "${key}" is not supported`,
        property
      );
    }
  }
  return metadata;
}

// ===== Templates and holes ===== //

function templateVariants(
  quasi: t.TemplateLiteral,
  context: TreeContext
): MessageTreeFragment[] {
  const strings = quasi.quasis.map((element) => {
    if (element.value.cooked == null) {
      throw new NonStaticMessageError(
        'the template contains an invalid escape sequence',
        element
      );
    }
    return element.value.cooked;
  });
  const holeLists = quasi.expressions.map((expression) =>
    holeVariants(expression, context)
  );
  return product(holeLists, quasi).map((holes) => ({ strings, holes }));
}

function holeVariants(
  hole: t.Expression | t.TSType,
  context: TreeContext
): MessageTreeHole[] {
  const expression = unwrapTypeScriptExpression(hole);
  if (t.isObjectExpression(expression)) {
    return [{ kind: 'argument', name: getVariableName(expression) }];
  }
  if (getHelperName(expression, context) === PLURAL_COUNT_CONSTANT) {
    return [{ kind: 'pound' }];
  }
  const fragments = fragmentVariants(expression, context);
  if (fragments) {
    return fragments.map((fragment) => ({ kind: 'fragment', ...fragment }));
  }
  if (t.isCallExpression(expression)) {
    const helper = getHelperName(expression.callee, context);
    const args = expression.arguments;
    switch (helper) {
      case 'plural':
      case 'selectordinal':
      case 'select':
        return branchHoleVariants(helper, expression, context);
      case 'number':
      case 'date': {
        if (args.length < 1 || args.length > 2) {
          throw new NonStaticMessageError(
            `${helper}() takes a variable and optional Intl options`,
            expression
          );
        }
        const variable = getHoleVariable(args[0], context);
        // Static literals are passed to Intl unchanged, as at runtime.
        const options = args[1] && getIntlOptions(args[1], context);
        return [
          {
            kind: helper,
            ...variable,
            ...(options && { options }),
          } as MessageTreeHole,
        ];
      }
      case DERIVE_FUNCTION:
        context.usesDerive = true;
        // Derived text is static, so it reads as if written in the template.
        return deriveVariants(expression, context).map((value) => ({
          kind: 'fragment',
          strings: [value],
          holes: [],
        }));
    }
    const imported = getNamedImport(expression.callee, context);
    if (imported && isLegacyGTImportSource(imported.source, GT_LIBRARIES)) {
      throw new NonStaticMessageError(
        `${imported.name}() is imported from ${imported.source}, which only works with gt() messages`,
        expression,
        undefined,
        USE_UNSTABLE_HELPERS_FIX
      );
    }
  }
  assertPlainValue(
    expression,
    context,
    'Write ${{ name }} or the helper call inside the template',
    { allowDate: false }
  );
  return [{ kind: 'anonymous' }];
}

// The runtime formats a plain value as an anonymous `_gt_N` argument, but reads
// an object as a { name: value } binding or a placeholder. A Date is plain only
// for a helper: its types reject a bare Date hole, which needs date().
function assertPlainValue(
  expression: t.Node,
  context: TreeContext,
  fix: string,
  { allowDate }: { allowDate: boolean }
): void {
  const plain = isPlainValue(
    context.config.file,
    expression.start!,
    expression.end!
  );
  if (typeof plain === 'object') throwTypeIssue(plain.issue, expression);
  if (plain === 'date' && !allowDate) {
    throw new NonStaticMessageError(
      'a Date needs date() to be formatted',
      expression,
      undefined,
      'Write ${date({ due })} or ${date(due, { dateStyle: "medium" })}'
    );
  }
  if (!plain) {
    throw new NonStaticMessageError(
      'the value is not typed as a primitive (it is an object, a symbol, any, unknown, or an unstable helper result built outside the template), so the runtime may not render it as a plain value',
      expression,
      undefined,
      fix
    );
  }
}

/**
 * The value a helper formats: named, like plural({ count }, ...), or passed
 * directly, like plural(count, ...), which the builder numbers as `_gt_N`.
 */
function getHoleVariable(
  node: t.Node | undefined,
  context: TreeContext
): { name?: string } {
  const value = node && unwrapTypeScriptExpression(node);
  if (!t.isExpression(value) || t.isObjectExpression(value)) {
    return { name: getVariableName(value) };
  }
  assertPlainValue(
    value,
    context,
    'Name the value, like plural({ count }, ...), or pass a plain value',
    { allowDate: true }
  );
  return {};
}

function branchHoleVariants(
  kind: 'plural' | 'selectordinal' | 'select',
  call: t.CallExpression,
  context: TreeContext
): MessageTreeHole[] {
  const [variable, branchesArg] = call.arguments;
  if (call.arguments.length !== 2 || !t.isObjectExpression(branchesArg)) {
    throw new NonStaticMessageError(
      `the ${kind}() branches are not an object literal`,
      branchesArg ?? call
    );
  }
  const holeVariable = getHoleVariable(variable, context);
  const keys: string[] = [];
  const branchLists: MessageTreeBranch[][] = [];
  for (const property of branchesArg.properties) {
    if (skipProtoSetter(property, context)) continue;
    keys.push(getPropertyKey(property));
    branchLists.push(
      branchVariants((property as t.ObjectProperty).value, context)
    );
  }
  return product(branchLists, call).map((branches) => ({
    kind,
    ...holeVariable,
    branches: Object.fromEntries(keys.map((key, i) => [key, branches[i]])),
  }));
}

function branchVariants(
  node: t.Node,
  context: TreeContext
): MessageTreeBranch[] {
  const value = unwrapTypeScriptExpression(node);
  if (t.isStringLiteral(value) || t.isTemplateLiteral(value)) {
    if (t.isTemplateLiteral(value) && value.expressions.length > 0) {
      throw new NonStaticMessageError(
        'a branch template literal has values but is not part`...`, so the runtime would render them as text',
        value,
        undefined,
        'Write branches with values as part`...`'
      );
    }
    return [getStaticText(value, 'a branch')];
  }
  const fragments = fragmentVariants(value, context);
  if (!fragments) {
    throw new NonStaticMessageError(
      'a branch is not a string literal or part`...`',
      value
    );
  }
  return fragments;
}

/**
 * Variants of a part`...` template, inline or through a same-file
 * `const x = part`...``. Returns undefined when the node is neither.
 */
function fragmentVariants(
  node: t.Node,
  context: TreeContext
): MessageTreeFragment[] | undefined {
  if (t.isTaggedTemplateExpression(node)) {
    if (getHelperName(node.tag, context) !== PART_FUNCTION) return;
    return templateVariants(node.quasi, context);
  }
  if (!t.isIdentifier(node)) return;
  const binding = context.scopePath.scope.getBinding(node.name);
  // A destructured name holds only part of the initializer.
  if (
    binding?.kind !== 'const' ||
    !binding.path.isVariableDeclarator() ||
    !t.isIdentifier(binding.path.node.id)
  ) {
    return;
  }
  const init = binding.path.get('init');
  if (
    !init.isTaggedTemplateExpression() ||
    getHelperName(init.node.tag, { ...context, scopePath: init }) !==
      PART_FUNCTION
  ) {
    return;
  }
  if (context.resolvingParts.has(init.node)) {
    throw new NonStaticMessageError('a part`...` refers to itself', node);
  }
  context.resolvingParts.add(init.node);
  try {
    // Resolve the part's own holes in the scope where it was declared.
    const partContext = { ...context, scopePath: init };
    const variants = templateVariants(init.node.quasi, partContext);
    context.usesDerive ||= partContext.usesDerive;
    return variants;
  } finally {
    context.resolvingParts.delete(init.node);
  }
}

/** Every value of derive(expr), read from the argument's TypeScript type. */
function deriveVariants(
  call: t.CallExpression,
  context: TreeContext
): string[] {
  const [argument] = call.arguments;
  if (call.arguments.length !== 1 || !t.isExpression(argument)) {
    throw new NonStaticMessageError(
      'derive() takes exactly one expression',
      call
    );
  }
  const result = getStringVariants(
    context.config.file,
    argument.start!,
    argument.end!
  );
  if ('variants' in result) {
    assertVariantLimit(result.variants.length, argument);
    return result.variants;
  }
  switch (result.issue) {
    case 'open':
      throw new NonStaticMessageError(
        'the derive() value is typed as any string, so its variants are unknown',
        argument,
        undefined,
        DERIVE_TYPE_FIX
      );
    case 'non-string':
      throw new NonStaticMessageError(
        'the derive() value is not typed as a string',
        argument,
        undefined,
        DERIVE_TYPE_FIX
      );
    default:
      return throwTypeIssue(result.issue, argument);
  }
}

const DERIVE_TYPE_FIX =
  'Type the value as a string literal or a union of them, such as a union type, a string enum, or an as const lookup';

function throwTypeIssue(issue: TypeIssue, node: t.Node): never {
  switch (issue) {
    case 'no-typescript':
      throw new NonStaticMessageError(
        'the typescript package is not installed, and the CLI reads values from their types',
        node,
        undefined,
        'Install typescript in the project'
      );
    case 'unsupported-typescript':
      throw new NonStaticMessageError(
        'TypeScript 7.0 has no compiler API, and the CLI reads values from their types',
        node,
        undefined,
        'Use TypeScript 7.1 or later, or TypeScript 6'
      );
    case 'typescript-error':
      throw new NonStaticMessageError(
        'the TypeScript compiler failed while reading this file',
        node
      );
    default:
      throw new NonStaticMessageError(
        'the value could not be found in the TypeScript program',
        node
      );
  }
}

// ===== Static values ===== //

/** Strips type-only wrappers (as, satisfies, !, <T>) and parentheses. */
function unwrapTypeScriptExpression(node: t.Expression): t.Expression;
function unwrapTypeScriptExpression(node: t.Node): t.Node;
function unwrapTypeScriptExpression(node: t.Node): t.Node {
  while (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

/** Name of an object property whose key is known statically. */
function getStaticPropertyKey(property: t.ObjectProperty): string | undefined {
  const key = property.key;
  if (!property.computed && t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isNumericLiteral(key)) return String(key.value);
  if (
    t.isTemplateLiteral(key) &&
    key.expressions.length === 0 &&
    key.quasis[0].value.cooked != null
  ) {
    return key.quasis[0].value.cooked;
  }
  return undefined;
}

/** Name of `{ name }` / `{ name: value }`: an object literal with exactly one key. */
function getVariableName(node: t.Node | undefined): string {
  if (!t.isObjectExpression(node) || node.properties.length !== 1) {
    throw new NonStaticMessageError(
      'a variable is not an object literal with exactly one key, like ${{ name }}',
      node ?? t.nullLiteral()
    );
  }
  const [property] = node.properties;
  if (isProtoSetter(property)) {
    throw new NonStaticMessageError(
      'a variable is named by a __proto__: key, which adds no property',
      property
    );
  }
  return getPropertyKey(property);
}

function getPropertyKey(
  property: t.ObjectExpression['properties'][number]
): string {
  const key = t.isObjectProperty(property)
    ? getStaticPropertyKey(property)
    : undefined;
  if (key === undefined) {
    throw new NonStaticMessageError(
      'an object key is not a static property name',
      property
    );
  }
  return key;
}

/**
 * `__proto__: value` sets the prototype instead of adding an own property;
 * shorthand and computed `['__proto__']` keys add one.
 */
function isProtoSetter(
  property: t.ObjectExpression['properties'][number]
): boolean {
  return (
    t.isObjectProperty(property) &&
    !property.computed &&
    !property.shorthand &&
    getStaticPropertyKey(property) === '__proto__'
  );
}

/** Skips a `__proto__:` property with a warning, as the runtime never sees it. */
function skipProtoSetter(
  property: t.ObjectExpression['properties'][number],
  context: TreeContext
): boolean {
  if (!isProtoSetter(property)) return false;
  context.output.warnings.add(
    warnIgnoredProtoPropertySync(context.config.file, formatLocation(property))
  );
  return true;
}

function getStaticText(node: t.Node, label: string): string {
  if (t.isStringLiteral(node)) return node.value;
  if (
    t.isTemplateLiteral(node) &&
    node.expressions.length === 0 &&
    node.quasis[0].value.cooked != null
  ) {
    return node.quasis[0].value.cooked;
  }
  throw new NonStaticMessageError(`${label} is not a string literal`, node);
}

function getNumber(node: t.Node): number | undefined {
  if (t.isNumericLiteral(node)) return node.value;
  if (
    t.isUnaryExpression(node) &&
    node.operator === '-' &&
    t.isNumericLiteral(node.argument)
  ) {
    return -node.argument.value;
  }
}

/** Flat Intl options object with literal values. */
function getIntlOptions(
  node: t.Node,
  context: TreeContext
): Record<string, string | number | boolean> {
  if (!t.isObjectExpression(node)) {
    throw new NonStaticMessageError(
      'the Intl options are not an object literal',
      node
    );
  }
  const entries: [string, string | number | boolean][] = [];
  for (const property of node.properties) {
    if (skipProtoSetter(property, context)) continue;
    const key = getPropertyKey(property);
    const value = (property as t.ObjectProperty).value;
    const number = getNumber(value);
    entries.push([
      key,
      number ??
        (t.isBooleanLiteral(value)
          ? value.value
          : getStaticText(value, `the Intl option "${key}"`)),
    ]);
  }
  // fromEntries keeps a computed ['__proto__'] key as an own property.
  return Object.fromEntries(entries);
}

// ===== Helpers ===== //

/** Original name of the unstable helper a callee or tag refers to. */
function getHelperName(
  callee: t.Node,
  context: TreeContext
): string | undefined {
  const imported = getNamedImport(callee, context);
  if (imported && isUnstableGTImportSource(imported.source)) {
    return imported.name;
  }
}

function getNamedImport(
  callee: t.Node,
  context: TreeContext
): { name: string; source: string } | undefined {
  if (!t.isIdentifier(callee)) return;
  const binding = context.scopePath.scope.getBinding(callee.name);
  if (
    !binding?.path.isImportSpecifier() ||
    !binding.path.parentPath.isImportDeclaration()
  ) {
    return;
  }
  return {
    name: getImportedName(binding.path.node),
    source: binding.path.parentPath.node.source.value,
  };
}

function getImportedName(specifier: t.ImportSpecifier): string {
  return t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value;
}

/** Every combination of one item per list, within MAX_MESSAGE_VARIANTS. */
function product<T>(lists: T[][], node: t.Node): T[][] {
  assertVariantLimit(
    lists.reduce((count, list) => count * list.length, 1),
    node
  );
  return lists.reduce<T[][]>(
    (combinations, list) =>
      combinations.flatMap((combination) =>
        list.map((item) => [...combination, item])
      ),
    [[]]
  );
}

function assertVariantLimit(size: number, node: t.Node): void {
  if (size > MAX_MESSAGE_VARIANTS) {
    throw new NonStaticMessageError(
      `it has ${size} derive() variants, more than the limit of ${MAX_MESSAGE_VARIANTS}`,
      node
    );
  }
}

function formatLocation(node: t.Node): string | undefined {
  const start = node.loc?.start;
  return start ? `${start.line}:${start.column}` : undefined;
}
