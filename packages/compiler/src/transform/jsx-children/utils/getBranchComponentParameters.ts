import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import {
  getPluralBranchKey,
  isAcceptedPluralForm,
  isPluralComponentName,
} from 'generaltranslation/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  BRANCH_CONTROL_PROPS,
  GT_COMPONENT_TYPES,
} from '../../../utils/constants/gt/constants';

export const createOtherPropError = (component: string) =>
  createDiagnosticMessage({
    whatHappened: `<${component}> has no other prop`,
    fix: 'Write the fallback as its children',
  });

const createInvalidExactPluralPropWarning = (prop: string, name: string) =>
  createDiagnosticMessage({
    whatHappened: `Ignored the ${prop} prop of <${name}>`,
    why: 'it is not an exact number',
    fix: 'Write the number without a leading zero or an exponent, as in _0 or _1000',
  });

/**
 * Given an object expression path, get branch component argument paths,
 * each with the key its branch is stored under: the children are the `other`
 * branch. `warn` is called for a property that is ignored, and `fail` for an
 * `other` prop.
 */
export function getBranchComponentParameters(
  parametersPath: NodePath<t.ObjectExpression>,
  canonicalName: string,
  warn: (diagnostic: string, node: t.Node) => void = () => {},
  fail: (diagnostic: string, node: t.Node) => void = () => {}
): [string, NodePath<t.Expression>][] {
  // Get the args
  return parametersPath
    .get('properties')
    .map((propertyPath) => {
      // filter out non expression values
      if (!propertyPath.isObjectProperty()) {
        return null;
      }
      const property = propertyPath.node;

      const valuePath = propertyPath.get('value');
      if (!valuePath.isExpression()) {
        return null;
      }

      // get property name
      let propertyName: string;
      if (t.isStringLiteral(property.key)) {
        propertyName = property.key.value;
      } else if (t.isIdentifier(property.key)) {
        propertyName = property.key.name;
      } else {
        return null;
      }

      // The children are the fallback
      if (propertyName === 'children') {
        return ['other', valuePath as NodePath<t.Expression>];
      }
      if (propertyName === 'other') {
        fail(createOtherPropError(canonicalName), property);
        return null;
      }

      // Filter out data-* attributes for Branch components
      if (
        canonicalName === GT_COMPONENT_TYPES.Branch &&
        propertyName.startsWith('data-')
      ) {
        return null;
      }

      // Filter by branch component type
      if (
        canonicalName === GT_COMPONENT_TYPES.Branch &&
        BRANCH_CONTROL_PROPS.has(propertyName)
      ) {
        return null;
      } else if (
        isPluralComponentName(canonicalName) &&
        !isAcceptedPluralForm(propertyName)
      ) {
        // `_01` looks like an exact number but is not a branch.
        if (/^_\d/.test(propertyName)) {
          warn(
            createInvalidExactPluralPropWarning(propertyName, canonicalName),
            property
          );
        }
        return null;
      }

      return [
        isPluralComponentName(canonicalName)
          ? getPluralBranchKey(propertyName)
          : propertyName,
        valuePath as NodePath<t.Expression>,
      ];
    })
    .filter((arg) => arg !== null) as [string, NodePath<t.Expression>][];
}
