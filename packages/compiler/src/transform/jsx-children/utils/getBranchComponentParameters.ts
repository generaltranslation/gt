import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import {
  getPluralBranchKey,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  BRANCH_CONTROL_PROPS,
  GT_COMPONENT_TYPES,
} from '../../../utils/constants/gt/constants';

const createChildrenWarning = (component: string) =>
  createDiagnosticMessage({
    whatHappened: `<${component}> does not render its children`,
    fix: 'Move the content to the other prop',
  });

const createInvalidExactPluralPropWarning = (prop: string) =>
  createDiagnosticMessage({
    whatHappened: `Ignored the ${prop} prop of <Plural>`,
    why: 'it is not an exact number',
    fix: 'Write the number without a leading zero or an exponent, as in _0 or _1000',
  });

/**
 * Given an object expression path, get branch component argument paths,
 * each with the key its branch is stored under. `warn` is called for a
 * property that holds content but is never rendered.
 */
export function getBranchComponentParameters(
  parametersPath: NodePath<t.ObjectExpression>,
  canonicalName: string,
  warn: (diagnostic: string, node: t.Node) => void = () => {}
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

      // Avoid children property
      if (propertyName === 'children') {
        warn(createChildrenWarning(canonicalName), property);
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
        canonicalName === GT_COMPONENT_TYPES.Plural &&
        !isAcceptedPluralForm(propertyName)
      ) {
        // `_01` looks like an exact number but is not a branch.
        if (/^_\d/.test(propertyName)) {
          warn(createInvalidExactPluralPropWarning(propertyName), property);
        }
        return null;
      }

      return [
        canonicalName === GT_COMPONENT_TYPES.Plural
          ? getPluralBranchKey(propertyName)
          : propertyName,
        valuePath as NodePath<t.Expression>,
      ];
    })
    .filter((arg) => arg !== null) as [string, NodePath<t.Expression>][];
}
