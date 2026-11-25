// The hash of a call site, in each form the compiler writes it there: the
// `$_hash` option of a `t` template, the `$_hash` of a precomputed message,
// and the `_hash` prop of a <T>. Any other compiled shape (such as a
// precomputed <T>) must extend this pattern, or those messages leave the
// files.
const HASH = '[0-9a-f]{16}';
export const HASH_ARGUMENT = new RegExp(
  `[{,]\\s*["']?\\$?_hash["']?\\s*:\\s*(["'\`])(${HASH})\\1`,
  'g'
);
const HASH_TOKEN = new RegExp(`(?<![0-9a-f])${HASH}(?![0-9a-f])`, 'g');

/**
 * The hashes of the <T> call sites in code a bundler wrote, sorted: the
 * `_hash` props, without the `$_hash` of `t` and `msg` templates.
 */
export function findJsxHashes(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(HASH_ARGUMENT)) {
    if (!match[0].includes('$')) found.add(match[2]);
  }
  return [...found].sort();
}

/** Every run of exactly as many hex characters as a hash in code, whatever surrounds it. */
export function findHashTokens(code: string): string[] {
  return code.match(HASH_TOKEN) ?? [];
}
