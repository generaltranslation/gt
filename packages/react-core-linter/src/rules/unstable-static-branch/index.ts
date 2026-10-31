/**
 * Static branch rule for the /unstable plural, selectordinal, and select.
 *
 * A branch is extracted as written, so it must be static text or a part`...`
 * template. A plain template literal with values turns them into text before
 * plural() sees it, so the message never matches a translation. TypeScript
 * catches most of these; this rule also catches the ones it cannot see, such
 * as constant values and branches read from a variable.
 */

import {
  ASTUtils,
  AST_NODE_TYPES,
  ESLintUtils,
  TSESTree,
} from '@typescript-eslint/utils';
import type {
  RuleContext,
  RuleFix,
  RuleFixer,
} from '@typescript-eslint/utils/ts-eslint';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { RULE_URL } from '../../utils/constants.js';

const createRule = ESLintUtils.RuleCreator((name) => `${RULE_URL}${name}`);

type MessageIds = 'needsPart' | 'notStatic';
type Context = Readonly<RuleContext<MessageIds, []>>;

const CHOICE_HELPERS = new Set(['plural', 'selectordinal', 'select']);
const PART_HELPER = 'part';

/** Whether a specifier imports only a type, which can't run as a tag. */
function isTypeOnly(specifier: TSESTree.ImportSpecifier): boolean {
  return (
    specifier.importKind === 'type' ||
    (specifier.parent as TSESTree.ImportDeclaration).importKind === 'type'
  );
}

/** The value specifier an identifier is imported through from an unstable entry. */
function getUnstableImport(
  context: Context,
  node: TSESTree.Node
): TSESTree.ImportSpecifier | undefined {
  if (node.type !== AST_NODE_TYPES.Identifier) return undefined;
  const variable = ASTUtils.findVariable(
    context.sourceCode.getScope(node),
    node
  );
  const def = variable?.defs[0];
  if (
    def?.type !== 'ImportBinding' ||
    def.node.type !== AST_NODE_TYPES.ImportSpecifier ||
    def.parent.type !== AST_NODE_TYPES.ImportDeclaration ||
    !isUnstableGTImportSource(def.parent.source.value) ||
    isTypeOnly(def.node)
  ) {
    return undefined;
  }
  return def.node;
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string {
  return specifier.imported.type === AST_NODE_TYPES.Identifier
    ? specifier.imported.name
    : specifier.imported.value;
}

function isHelper(context: Context, node: TSESTree.Node, name: string) {
  const specifier = getUnstableImport(context, node);
  return specifier !== undefined && getImportedName(specifier) === name;
}

/** Strips `as`, `satisfies`, `!`, and `<T>`, which don't run. */
function unwrap(node: TSESTree.Node): TSESTree.Node {
  while (
    node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    node.type === AST_NODE_TYPES.TSNonNullExpression ||
    node.type === AST_NODE_TYPES.TSTypeAssertion
  ) {
    node = node.expression;
  }
  return node;
}

function isPart(context: Context, node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.TaggedTemplateExpression &&
    isHelper(context, node.tag, PART_HELPER)
  );
}

/** The CLI reads a branch inline, or a part`...` behind a same-file const. */
function isExtractableBranch(context: Context, node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.Literal)
    return typeof node.value === 'string';
  if (node.type === AST_NODE_TYPES.TemplateLiteral) {
    return node.expressions.length === 0;
  }
  if (isPart(context, node)) return true;
  if (node.type !== AST_NODE_TYPES.Identifier) return false;
  const variable = ASTUtils.findVariable(
    context.sourceCode.getScope(node),
    node
  );
  const def = variable?.defs[0];
  return (
    def?.type === 'Variable' &&
    def.parent.kind === 'const' &&
    def.node.id.type === AST_NODE_TYPES.Identifier &&
    def.node.init != null &&
    isPart(context, unwrap(def.node.init))
  );
}

/**
 * The local name for part at `node`: an existing unstable value import, or
 * `part` added to the helper's import. Undefined when `part` means something
 * else there, including a type-only import, so no fix is offered.
 */
function getPartName(
  context: Context,
  node: TSESTree.Node,
  helperImport: TSESTree.ImportSpecifier,
  fixer: RuleFixer,
  fixes: RuleFix[]
): string | undefined {
  const scope = context.sourceCode.getScope(node);
  for (const statement of context.sourceCode.ast.body) {
    if (
      statement.type !== AST_NODE_TYPES.ImportDeclaration ||
      !isUnstableGTImportSource(statement.source.value)
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === AST_NODE_TYPES.ImportSpecifier &&
        getImportedName(specifier) === PART_HELPER &&
        !isTypeOnly(specifier) &&
        ASTUtils.findVariable(scope, specifier.local.name)?.defs[0]?.node ===
          specifier
      ) {
        return specifier.local.name;
      }
    }
  }
  if (ASTUtils.findVariable(scope, PART_HELPER)) return undefined;
  // Append after the last named import, as import-utils does.
  const declaration = helperImport.parent as TSESTree.ImportDeclaration;
  const named = declaration.specifiers.filter(
    (specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier
  );
  fixes.push(
    fixer.insertTextAfter(named[named.length - 1], `, ${PART_HELPER}`)
  );
  return PART_HELPER;
}

export const unstableStaticBranch = createRule<[], MessageIds>({
  name: 'unstable-static-branch',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require /unstable plural, selectordinal, and select branches to be static text or part`...`.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      needsPart:
        'This branch has values, and a plain template literal turns them into text, so the message never matches a translation. Write it as part`...` (e.g. other: part`${n} items`).',
      notStatic:
        'Write this branch inline as a string or part`...`, or as a const holding part`...`, so the CLI can extract the message.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const helperImport = getUnstableImport(context, node.callee);
        if (
          !helperImport ||
          !CHOICE_HELPERS.has(getImportedName(helperImport))
        ) {
          return;
        }
        const branches = node.arguments[1];
        if (branches?.type !== AST_NODE_TYPES.ObjectExpression) return;
        for (const property of branches.properties) {
          if (property.type !== AST_NODE_TYPES.Property) continue;
          const value = unwrap(property.value);
          if (isExtractableBranch(context, value)) continue;
          if (value.type !== AST_NODE_TYPES.TemplateLiteral) {
            context.report({ node: property.value, messageId: 'notStatic' });
            continue;
          }
          context.report({
            node: value,
            messageId: 'needsPart',
            // A tagged template can't take `as const`, so wrapped ones get no fix.
            fix:
              value === property.value
                ? (fixer) => {
                    const fixes: RuleFix[] = [];
                    const name = getPartName(
                      context,
                      value,
                      helperImport,
                      fixer,
                      fixes
                    );
                    if (!name) return null;
                    return [...fixes, fixer.insertTextBefore(value, name)];
                  }
                : null,
          });
        }
      },
    };
  },
});
