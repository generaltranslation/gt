import { GTProp, JsxChild, JsxChildren } from 'generaltranslation/types';

import { isVariable } from 'generaltranslation/internal';

export function removeNullChildrenFields(tree: JsxChildren): JsxChildren {
  return handleChildren(tree);

  function handleChildren(children: JsxChildren): JsxChildren {
    if (Array.isArray(children)) {
      return children.filter((child) => child != null).map(handleChild);
    }
    return handleChild(children);
  }

  function handleChild(child: JsxChild): JsxChild {
    if (typeof child === 'string') {
      return child;
    }
    if (typeof child !== 'object' || child === null) {
      return child;
    }
    if (isVariable(child)) {
      return child;
    }
    // other fields
    let t: string | undefined;
    if (child && 't' in child && child.t != null) {
      t = child.t;
    }
    let i: number | undefined;
    if (child && 'i' in child && child.i != null) {
      i = child.i;
    }
    // gtprop
    let d: GTProp | undefined;
    if (child && 'd' in child && child.d != null) {
      let b: Record<string, JsxChildren> | undefined;
      if (child.d && 'b' in child.d && child.d.b != null) {
        b = {
          ...Object.fromEntries(
            Object.entries(child.d.b).map(([key, value]) => [
              key,
              handleChildren(value),
            ])
          ),
        };
      }
      d = {
        ...(b != null && { b }),
        ...(child.d?.t != null && { t: child.d.t }),
        ...Object.fromEntries(
          Object.entries(child.d)
            .filter(
              ([key, value]) => key !== 'b' && key !== 't' && value != null
            )
            .map(([key, value]) => [key, value])
        ),
      };
    }
    // children
    let c: JsxChildren | undefined;
    if (child && 'c' in child && child.c != null) {
      c = handleChildren(child.c);
    }
    return {
      ...(t != null && { t }),
      ...(i != null && { i }),
      ...(d != null && { d }),
      ...(c != null && { c }),
    };
  }
}
