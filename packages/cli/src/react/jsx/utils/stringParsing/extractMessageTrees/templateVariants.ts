import * as t from '@babel/types';
import type {
  MessageTreeBranch,
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
  unwrapTypeScriptExpression,
} from './staticValues.js';
import { assertPlainValue, deriveVariants } from './typedValues.js';
import type { TreeContext } from './types.js';

const PART_FUNCTION = 'part';

const PLURAL_COUNT_CONSTANT = 'n';

const USE_UNSTABLE_HELPERS_FIX =
  'Import derive() from the same unstable entry as t, useGT, or getGT';

export function templateVariants(
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
