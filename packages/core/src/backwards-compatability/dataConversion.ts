import { Variable as VariableObject, VariableType } from '../types';
import {
  OldBranchType,
  OldGTProp,
  OldJsxChild,
  OldJsxChildren,
  OldJsxElement,
  OldVariableObject,
  OldVariableType,
} from './oldTypes.js';
import { GTProp, JsxChild, JsxChildren, JsxElement } from '../types';
import {
  isOldJsxChildren,
  isNewVariableObject,
  isOldVariableObject,
} from './typeChecking';

/**
 * Converts request data from the old JSX format to the current format.
 */
export function getNewJsxChild(child: OldJsxChild): JsxChild {
  if (typeof child === 'string') {
    return child;
  }

  if (isOldVariableObject(child)) {
    return getNewVariableObject(child);
  }

  return getNewJsxElement(child);
}

export function getNewJsxChildren(children: OldJsxChildren): JsxChildren {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(getNewJsxChild);
  }

  return getNewJsxChild(children);
}

export function getNewJsxElement(element: OldJsxElement): JsxElement {
  if (typeof element === 'string') {
    return element;
  }

  let t: string | undefined = undefined;
  if (element.type != null) {
    t = element.type;
  }
  let c: JsxChildren | undefined = undefined;
  if (element.props?.children != null) {
    c = getNewJsxChildren(element.props.children);
  }
  return {
    ...(t && { t }),
    ...(c && { c }),
    d: getNewGTProp(element.props['data-_gt']),
    i: element.props['data-_gt'].id,
  };
}

export function getNewBranchType(branch: OldBranchType): 'b' | 'p' {
  if (branch === 'branch') {
    return 'b';
  }
  return 'p';
}

export function getNewVariableType(variable: OldVariableType): VariableType {
  switch (variable) {
    case 'number':
      return 'n';
    case 'variable':
      return 'v';
    case 'datetime':
      return 'd';
    case 'currency':
      return 'c';
    default:
      return 'v';
  }
}

export function getNewVariableObject(
  variable: OldVariableObject
): VariableObject {
  let v: VariableType | undefined = undefined;
  if (variable.variable != null) {
    v = getNewVariableType(variable.variable);
  }
  let i: number | undefined = undefined;
  if (variable.id != null) {
    i = variable.id;
  }
  return {
    k: variable.key,
    ...(v && { v }),
    ...(i && { i }),
  };
}

export function getNewGTProp(dataGT: OldGTProp): GTProp {
  let b: Record<string, JsxChildren> | undefined = undefined;
  if (dataGT.branches) {
    b = Object.fromEntries(
      Object.entries(dataGT.branches).map(([key, value]) => [
        key,
        getNewJsxChildren(value),
      ])
    );
  }
  let t: 'b' | 'p' | undefined;
  if (dataGT.transformation) {
    t = getNewBranchType(dataGT.transformation);
  }
  return { ...(b && { b }), ...(t && { t }) };
}

/**
 * Converts response data from the current JSX format to the old format.
 */
export function getOldJsxChild(child: JsxChild): OldJsxChild {
  if (typeof child === 'string') {
    return child;
  }

  if (isNewVariableObject(child)) {
    return getOldVariableObject(child);
  }

  return getOldJsxElement(child);
}

export function getOldJsxChildren(
  children: JsxChildren | OldJsxChildren
): OldJsxChildren {
  if (isOldJsxChildren(children)) {
    return children;
  }

  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(getOldJsxChild);
  }

  return getOldJsxChild(children);
}

export function getOldJsxElement(element: JsxElement): OldJsxElement {
  const type: string = element.t as string;
  let children: OldJsxChildren | undefined = undefined;
  if (element.c != null) {
    children = getOldJsxChildren(element.c);
  }
  const dataGT: OldGTProp = getOldGTProp(element.d || {}, element.i as number);
  return {
    type,
    props: { children, 'data-_gt': dataGT },
  };
}

export function getOldBranchType(branch: 'b' | 'p'): OldBranchType {
  if (branch === 'b') {
    return 'branch';
  }
  return 'plural';
}

export function getOldVariableType(variable: VariableType): OldVariableType {
  switch (variable) {
    case 'n':
      return 'number';
    case 'v':
      return 'variable';
    case 'd':
      return 'datetime';
    case 'c':
      return 'currency';
    default:
      return 'variable';
  }
}

export function getOldVariableObject(
  variable: VariableObject
): OldVariableObject {
  let v: OldVariableType | undefined = undefined;
  if (variable.v != null) {
    v = getOldVariableType(variable.v);
  }
  let i: number | undefined = undefined;
  if (variable.i != null) {
    i = variable.i;
  }
  return {
    key: variable.k,
    ...(v && { variable: v }),
    ...(i && { id: i }),
  };
}

export function getOldGTProp(dataGT: GTProp, i: number): OldGTProp {
  let transformation: OldBranchType | undefined = undefined;
  if (dataGT.t != null) {
    transformation = getOldBranchType(dataGT.t);
  }
  let branches: Record<string, OldJsxChildren> | undefined = undefined;
  if (dataGT.b != null) {
    branches = Object.fromEntries(
      Object.entries(dataGT.b).map(([key, value]) => [
        key,
        getOldJsxChildren(value),
      ])
    );
  }
  return {
    id: i,
    ...(transformation && { transformation }),
    ...(branches && { branches }),
  };
}
