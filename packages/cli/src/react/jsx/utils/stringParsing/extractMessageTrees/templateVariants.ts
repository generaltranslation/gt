import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type {
  MessageTreeBranch,
  MessageTreeChoiceKind,
  MessageTreeFragment,
  MessageTreeHole,
} from '@generaltranslation/icu/internal';
import {
  GT_LIBRARIES,
  isLegacyGTImportSource,
} from '../../../../../types/libraries.js';
import { DERIVE_FUNCTION } from '../../constants.js';
import { product } from './combinations.js';
import { NonStaticMessageError } from './diagnostics.js';
import { getHelperName, getNamedImport } from './imports.js';
import {
  getIntlOptions,
  getPropertyKey,
  getStaticText,
  getVariableName,
  skipProtoSetter,
} from './staticValues.js';
import { assertPlainValue, deriveVariants } from './typedValues.js';
import type { TreeContext } from './types.js';

// The compiler mirrors this walker without derive() in
// packages/compiler/src/transform/injection/injectUnstableTaggedTemplateHash.ts;
// test-fixtures/icu-tree-wire-format.json keeps both on the same hashes.

const USE_UNSTABLE_HELPERS_FIX =
  'Import derive() from the same unstable entry as t, useGT, or getGT';

export function templateVariants(
  quasi: NodePath<t.TemplateLiteral>,
  context: TreeContext
): MessageTreeFragment[] {
  const strings = quasi.node.quasis.map((element) => {
    if (element.value.cooked == null) {
      throw new NonStaticMessageError(
        'the template contains an invalid escape sequence',
        element
      );
    }
    return element.value.cooked;
  });
  const holeLists = quasi
    .get('expressions')
    .map((expression) => holeVariants(expression, context));
  return product(holeLists, quasi.node).map((holes) => ({ strings, holes }));
}

/** Strips type-only wrappers (as, satisfies, !, <T>) and parentheses. */
function unwrapTypeScriptPath(path: NodePath): NodePath {
  while (
    path.isTSAsExpression() ||
    path.isTSSatisfiesExpression() ||
    path.isTSNonNullExpression() ||
    path.isTSTypeAssertion() ||
    path.isParenthesizedExpression()
  ) {
    // A union of wrapper paths types get() as a path or array; each wrapper
    // holds a single expression.
    path = path.get('expression') as NodePath<t.Expression>;
  }
  return path;
}

function holeVariants(
  hole: NodePath<t.Expression | t.TSType>,
  context: TreeContext
): MessageTreeHole[] {
  const expression = unwrapTypeScriptPath(hole);
  if (expression.isObjectExpression()) {
    return [{ kind: 'argument', name: getVariableName(expression.node) }];
  }
  if (getHelperName(expression) === 'n') {
    return [{ kind: 'pound' }];
  }
  const fragments = fragmentVariants(expression, context);
  if (fragments) {
    return fragments.map((fragment) => ({ kind: 'fragment', ...fragment }));
  }
  if (expression.isCallExpression()) {
    const callee = expression.get('callee');
    const helper = getHelperName(callee);
    const args = expression.get('arguments');
    switch (helper) {
      case 'plural':
      case 'selectordinal':
      case 'select':
        return branchHoleVariants(helper, expression, context);
      case 'number':
      case 'date':
      case 'time': {
        if (args.length < 1 || args.length > 2) {
          throw new NonStaticMessageError(
            `${helper}() takes a variable and optional Intl options`,
            expression.node
          );
        }
        const variable = getHoleVariable(args[0], context);
        const options =
          args[1] && getIntlOptions(args[1].node, helper, context);
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
        return deriveVariants(expression.node, context).map((value) => ({
          kind: 'fragment',
          strings: [value],
          holes: [],
        }));
    }
    const imported = getNamedImport(callee);
    if (imported && isLegacyGTImportSource(imported.source, GT_LIBRARIES)) {
      throw new NonStaticMessageError(
        `${imported.name}() is imported from ${imported.source}, which only works with gt() messages`,
        expression.node,
        undefined,
        USE_UNSTABLE_HELPERS_FIX
      );
    }
  }
  assertPlainValue(
    expression.node,
    context,
    'Write ${{ name }} or the helper call inside the template',
    { allowDate: false }
  );
  return [{ kind: 'anonymous' }];
}

/**
 * The value a helper formats: named, like plural({ count }, ...), or passed
 * directly, like plural(count, ...), which the builder numbers as `_gt_N`.
 */
function getHoleVariable(
  path: NodePath | undefined,
  context: TreeContext
): { name?: string } {
  const value = path && unwrapTypeScriptPath(path).node;
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
  kind: MessageTreeChoiceKind,
  call: NodePath<t.CallExpression>,
  context: TreeContext
): MessageTreeHole[] {
  const args = call.get('arguments');
  const [variable, branchesArg] = args;
  if (args.length !== 2 || !branchesArg.isObjectExpression()) {
    throw new NonStaticMessageError(
      `the ${kind}() branches are not an object literal`,
      branchesArg?.node ?? call.node
    );
  }
  const holeVariable = getHoleVariable(variable, context);
  const keys: string[] = [];
  const branchLists: MessageTreeBranch[][] = [];
  for (const property of branchesArg.get('properties')) {
    if (skipProtoSetter(property.node, context)) continue;
    keys.push(getPropertyKey(property.node));
    // getPropertyKey throws for anything but an ObjectProperty.
    const value = (property as NodePath<t.ObjectProperty>).get('value');
    branchLists.push(branchVariants(value, context));
  }
  return product(branchLists, call.node).map((branches) => ({
    kind,
    ...holeVariable,
    branches: Object.fromEntries(keys.map((key, i) => [key, branches[i]])),
  }));
}

function branchVariants(
  path: NodePath,
  context: TreeContext
): MessageTreeBranch[] {
  const valuePath = unwrapTypeScriptPath(path);
  const value = valuePath.node;
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
  const fragments = fragmentVariants(valuePath, context);
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
  path: NodePath,
  context: TreeContext
): MessageTreeFragment[] | undefined {
  if (path.isTaggedTemplateExpression()) {
    if (getHelperName(path.get('tag')) !== 'part') return;
    return templateVariants(path.get('quasi'), context);
  }
  if (!path.isIdentifier()) return;
  const binding = path.scope.getBinding(path.node.name);
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
    getHelperName(init.get('tag')) !== 'part'
  ) {
    return;
  }
  if (context.resolvingParts.has(init.node)) {
    throw new NonStaticMessageError('a part`...` refers to itself', path.node);
  }
  context.resolvingParts.add(init.node);
  try {
    return templateVariants(init.get('quasi'), context);
  } finally {
    context.resolvingParts.delete(init.node);
  }
}
