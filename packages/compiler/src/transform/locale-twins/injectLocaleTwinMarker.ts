import * as t from '@babel/types';
import type { LocaleTwinEntryApi } from '../../state/LocaleTwinCollector';
import { LOCALE_TWIN_MARKER } from '../../utils/constants/gt/constants';
import { getObjectPropertyFromObjectExpression } from '../../utils/parsing/getObjectPropertyFromObjectExpression';

/**
 * Adds the locale twin marker to a call site: the `_twin` prop of a
 * `jsx(T, props)` call, or the `$_twin` option of a `gt()` / `t()` / `msg()`
 * call (creating or extending its options object). A call that already has
 * the marker keeps it.
 *
 * @returns Whether the call carries the marker afterwards. A call whose
 * props are not an object literal, or that has more than two arguments,
 * cannot carry it.
 */
export function injectLocaleTwinMarker(
  api: LocaleTwinEntryApi,
  callExpr: t.CallExpression,
  value: t.Expression
): boolean {
  if (api === 'T') {
    const props = callExpr.arguments[1];
    if (!t.isObjectExpression(props)) return false;
    return addProperty(props, LOCALE_TWIN_MARKER.prop, value);
  }

  const args = callExpr.arguments;
  const marker = () =>
    t.objectProperty(t.identifier(LOCALE_TWIN_MARKER.option), value);
  if (args.length === 1) {
    args.push(t.objectExpression([marker()]));
    return true;
  }
  if (args.length !== 2) return false;
  const options = args[1];
  if (t.isObjectExpression(options)) {
    return addProperty(options, LOCALE_TWIN_MARKER.option, value);
  }
  if (!t.isExpression(options)) return false;
  args[1] = t.objectExpression([t.spreadElement(options), marker()]);
  return true;
}

function addProperty(
  object: t.ObjectExpression,
  key: string,
  value: t.Expression
): boolean {
  if (getObjectPropertyFromObjectExpression(object, key) === undefined) {
    object.properties.push(t.objectProperty(t.identifier(key), value));
  }
  return true;
}
