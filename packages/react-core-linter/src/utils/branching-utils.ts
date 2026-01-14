import { BRANCH_COMPONENT_NAME, BRANCH_COMPONENT_NAMES } from './constants.js';
import { TSESTree } from '@typescript-eslint/utils';

const BRANCH_COMPONENT_BRANCH_PROPERTY = 'branch';
const PLURAL_COMPONENT_BRANCH_PROPERTY = 'n';

function getBranchingProp(
  name: (typeof BRANCH_COMPONENT_NAMES)[number]
):
  | typeof BRANCH_COMPONENT_BRANCH_PROPERTY
  | typeof PLURAL_COMPONENT_BRANCH_PROPERTY {
  return name === BRANCH_COMPONENT_NAME
    ? BRANCH_COMPONENT_BRANCH_PROPERTY
    : PLURAL_COMPONENT_BRANCH_PROPERTY;
}

/**
 * Returns true if the given branch is a content branch
 */
export function isContentBranch({
  tScope,
  node,
}: {
  tScope: string;
  node: TSESTree.JSXAttribute;
}): boolean {
  const propertyName =
    node.name.type === TSESTree.AST_NODE_TYPES.JSXIdentifier
      ? node.name.name
      : null;
  if (propertyName === getBranchingProp(tScope)) {
    return false;
  }
  return true;
}
