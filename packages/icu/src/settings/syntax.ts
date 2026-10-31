// Explicit Unicode White_Space + Pattern_Syntax ranges avoid a module-load
// syntax error in engines that support `u` regexes but not property escapes.
/** A character that ends an ICU argument name. */
export const IDENTIFIER_BOUNDARY =
  /[\t-\r \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\x21-\x2F\x3A-\x40\x5B-\x5E\x60\x7B-\x7E\xA1-\xA7\xA9\xAB\xAC\xAE\xB0\xB1\xB6\xBB\xBF\xD7\xF7\u2010-\u2027\u2030-\u203E\u2041-\u2053\u2055-\u205E\u2190-\u245F\u2500-\u2775\u2794-\u2BFF\u2E00-\u2E7F\u3001-\u3003\u3008-\u3020\u3030\uFD3E-\uFD3F\uFE45-\uFE46]/u;

// The parser skips these as whitespace before a name, so they cannot start one.
const LEADING_DIRECTION_MARK = /^[\u200E\u200F]/u;

/** Whether `name` parses back as a single ICU argument name. */
export function isArgumentName(name: string): boolean {
  return (
    name.length > 0 &&
    !IDENTIFIER_BOUNDARY.test(name) &&
    !LEADING_DIRECTION_MARK.test(name)
  );
}
