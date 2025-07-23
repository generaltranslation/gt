/* 
  ========= Old Jsx format =========
  "728725808f9ba9569acdfa05c371304a30cd879ca89c20e6d374118c5b5c2c12": {
    "type": "div",
    "props": {
      "children": [
        {
          "type": "div",
          "props": {
            "children": [
              {
                "type": "h1",
                "props": {
                  "children": "ショーケース",
                  "data-_gt": {
                    "id": 3
                  }
                }
              },
              {
                "type": "p",
                "props": {
                  "children": "Mastraで構築されたこれらのアプリケーションをご覧ください。",
                  "data-_gt": {
                    "id": 4
                  }
                }
              }
            ],
            "data-_gt": {
              "id": 2
            }
          }
        },
        {
          "type": "div",
          "props": {
            "children": {
              "id": 6,
              "key": "_gt_value_6",
              "variable": "variable"
            },
            "data-_gt": {
              "id": 5
            }
          }
        }
      ],
      "data-_gt": {
        "id": 1
      }
    }
  },

  ========= New Jsx format =========

    "88abd9bf3feea227": [
    {
      "i": 1,
      "c": [
        "© ",
        {
          "i": 2,
          "k": "_gt_date_2",
          "v": "d"
        },
        " General Translation, Inc."
      ]
    },
    {
      "i": 3,
      "c": "服务条款"
    },
    {
      "i": 4,
      "c": "隐私",
      "t": "Link"
    },
    {
      "i": 5,
      "c": "Cookie设置"
    }
  ],
*/

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
 * Convert request data from old format to new format
 */

export function getNewJsxChild(child: OldJsxChild): JsxChild {
  // string (end case)
  if (typeof child === 'string') {
    return child;
  }

  // VariableObject
  if (isOldVariableObject(child)) {
    return getNewVariableObject(child);
  }

  // JsxElement
  return getNewJsxElement(child);
}

export function getNewJsxChildren(children: OldJsxChildren): JsxChildren {
  // string (end case)
  if (typeof children === 'string') {
    return children;
  }

  // Array
  if (Array.isArray(children)) {
    return children.map(getNewJsxChild);
  }

  // Object
  return getNewJsxChild(children);
}

export function getNewJsxElement(element: OldJsxElement): JsxElement {
  // string (end case)
  if (typeof element === 'string') {
    return element;
  }

  // type
  let t: string | undefined = undefined;
  if (element.type != null) {
    t = element.type;
  }
  // children
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
  // variable type
  let v: VariableType | undefined = undefined;
  if (variable.variable != null) {
    v = getNewVariableType(variable.variable);
  }
  // variable id
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
  // branches
  let b: Record<string, JsxChildren> | undefined = undefined;
  if (dataGT.branches) {
    b = Object.fromEntries(
      Object.entries(dataGT.branches).map(([key, value]) => [
        key,
        getNewJsxChildren(value),
      ])
    );
  }
  // transformation
  let t: 'b' | 'p' | undefined;
  if (dataGT.transformation) {
    t = getNewBranchType(dataGT.transformation);
  }
  return { ...(b && { b }), ...(t && { t }) };
}

/**
 * Convert response data from old format to new format
 */

export function getOldJsxChild(child: JsxChild): OldJsxChild {
  // string (end case)
  if (typeof child === 'string') {
    return child;
  }

  // VariableObject
  if (isNewVariableObject(child)) {
    return getOldVariableObject(child);
  }

  // JsxElement
  return getOldJsxElement(child);
}

export function getOldJsxChildren(
  children: JsxChildren | OldJsxChildren
): OldJsxChildren {
  // if children is already old, return it
  if (isOldJsxChildren(children)) {
    return children;
  }

  // string (end case)
  if (typeof children === 'string') {
    return children;
  }

  // Array
  if (Array.isArray(children)) {
    return children.map(getOldJsxChild);
  }

  // Object
  return getOldJsxChild(children);
}

export function getOldJsxElement(element: JsxElement): OldJsxElement {
  // type (can assume that type will exist here)
  const type: string = element.t as string;
  // children
  let children: OldJsxChildren | undefined = undefined;
  if (element.c != null) {
    children = getOldJsxChildren(element.c);
  }
  // data-_gt (can assume id will exist here)
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
  // variable type
  let v: OldVariableType | undefined = undefined;
  if (variable.v != null) {
    v = getOldVariableType(variable.v);
  }
  // variable id
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
  // transformation
  let transformation: OldBranchType | undefined = undefined;
  if (dataGT.t != null) {
    transformation = getOldBranchType(dataGT.t);
  }
  // branches
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
