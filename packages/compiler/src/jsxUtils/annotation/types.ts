import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../../constants';

/**
 * JSXElementWithCanonicalId is a JSXElement with a _gt_canonical_identifier field
 * For marking GT components
 */
export type JSXElementWithCanonicalId = t.JSXElement & {
  _gt_canonical_identifier?: GT_COMPONENT_TYPES;
};
