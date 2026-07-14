import type {
  JsxChild,
  JsxChildren,
  JsxElement,
} from '@generaltranslation/format/types';
import { GT_COMPONENT_TYPES } from '../../../utils/constants/gt/constants';

/**
 * Returns true when a constructed JsxChildren tree contains a <Derive>
 * element at any depth (including Branch/Plural branches).
 *
 * A <T> with <Derive> children maps to multiple translation variants — one
 * hash per resolved variant — so a single compile-time hash cannot be
 * injected; the runtime must compute the hash from the resolved children.
 */
export function containsDeriveElement(
  children: JsxChildren | undefined
): boolean {
  if (children === undefined) {
    return false;
  }
  if (Array.isArray(children)) {
    return children.some((child) => childContainsDerive(child));
  }
  return childContainsDerive(children);
}

function childContainsDerive(child: JsxChild): boolean {
  if (typeof child === 'string') {
    return false;
  }
  // Variable nodes ({ k, i, v }) carry no children
  if ('k' in child) {
    return false;
  }
  const element = child as JsxElement;
  if (element.t === GT_COMPONENT_TYPES.Derive) {
    return true;
  }
  if (element.c !== undefined && containsDeriveElement(element.c)) {
    return true;
  }
  if (element.d?.b) {
    return Object.values(element.d.b).some((branch) =>
      containsDeriveElement(branch)
    );
  }
  return false;
}
