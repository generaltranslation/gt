/**
 * Deterministic JSON stringification with sorted object keys.
 * Drop-in replacement for `fast-json-stable-stringify` for plain
 * JSON-compatible data (no toJSON, no circular references).
 */
function _stringify(node: unknown): string | undefined {
  if (node === undefined) return undefined;
  if (node === null) return 'null';
  if (typeof node === 'number') return isFinite(node) ? '' + node : 'null';
  if (typeof node !== 'object') return JSON.stringify(node);

  if (Array.isArray(node)) {
    let out = '[';
    for (let i = 0; i < node.length; i++) {
      if (i) out += ',';
      out += _stringify(node[i]) || 'null';
    }
    return out + ']';
  }

  const keys = Object.keys(node as Record<string, unknown>).sort();
  let out = '';
  for (const key of keys) {
    const value = _stringify((node as Record<string, unknown>)[key]);
    if (!value) continue;
    if (out) out += ',';
    out += JSON.stringify(key) + ':' + value;
  }
  return '{' + out + '}';
}

export function stableStringify(data: unknown): string {
  return _stringify(data) ?? '';
}
