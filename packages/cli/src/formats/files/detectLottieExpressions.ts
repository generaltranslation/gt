import { unzipSync } from 'fflate';

import type { JSONValue } from '../../types/data/json.js';

// After Effects "expressions" are JavaScript strings attached to an animated
// property at key `x`; the full lottie-web build evaluates them with eval() at
// render time, so a crafted .lottie is an arbitrary-code-execution vector. Until
// the renderer strips/sandboxes them, we reject any Lottie that carries one.
//
// A split-dimension position ALSO uses `x`, but as an object/array (a nested
// property) — never a string. So a non-empty string value at key `x` is the
// unambiguous marker of an expression.
function hasExpressionNode(node: JSONValue): boolean {
  if (Array.isArray(node)) {
    for (const v of node) if (hasExpressionNode(v)) return true;
    return false;
  }
  if (node !== null && typeof node === 'object') {
    const x = (node as { [key: string]: JSONValue }).x;
    if (typeof x === 'string' && x.trim() !== '') return true;
    for (const key in node) {
      if (hasExpressionNode((node as { [key: string]: JSONValue })[key])) {
        return true;
      }
    }
  }
  return false;
}

function jsonHasExpression(text: string): boolean {
  try {
    return hasExpressionNode(JSON.parse(text) as JSONValue);
  } catch {
    return false; // not JSON — nothing to scan
  }
}

/**
 * Returns true if a base64-encoded Lottie carries any After Effects expression
 * (executable JavaScript). Handles both the dotLottie ZIP bundle (scans each
 * `animations/*.json`) and a bare bodymovin JSON that uses the `.lottie`
 * extension. Best-effort: an unreadable/non-Lottie payload returns false and is
 * left to the existing upload validation.
 */
export function lottieHasExpressions(base64Content: string): boolean {
  const bytes = Buffer.from(base64Content, 'base64');
  try {
    // Only decompress JSON entries — skip embedded images/fonts/audio.
    const entries = unzipSync(bytes, {
      filter: (file) => file.name.toLowerCase().endsWith('.json'),
    });
    for (const data of Object.values(entries)) {
      if (jsonHasExpression(Buffer.from(data).toString('utf8'))) return true;
    }
    return false;
  } catch {
    // Not a valid ZIP — maybe a bare bodymovin JSON with a .lottie extension.
    return jsonHasExpression(bytes.toString('utf8'));
  }
}
