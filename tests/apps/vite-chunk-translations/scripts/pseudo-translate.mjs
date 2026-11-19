// Writes src/_gt/<locale>.json: every message of the app with its text in
// upper case for `fr` and in lower case for `de`, so a check can tell a
// locale's translation from the source and from the other locale.
//
// The messages are read from a build of the app, where the compiler has
// computed each hash: `<T>` sources from its debug hash manifest, and `t`
// messages from the calls it writes into each module (collectMessages.mjs).
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const treesPath = join(root, '.check', 'messages.json');
const jsxPath = join(root, '_gt_debug_hash_manifest.json');

const CASES = {
  fr: (text) => text.toUpperCase(),
  de: (text) => text.toLowerCase(),
};

execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'warn'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    GT_CHUNK_TRANSLATIONS: 'true',
    CHECK_OUT_DIR: join(root, '.check', 'collect'),
    CHECK_MESSAGES: treesPath,
  },
});

const trees = JSON.parse(readFileSync(treesPath, 'utf8'));
const jsx = JSON.parse(readFileSync(jsxPath, 'utf8'));
rmSync(jsxPath);

/** A message tree with the text of every branch in another case. */
function translateTree(tree, change) {
  if (typeof tree === 'string') return change(tree);
  return tree.map((node) => {
    if (typeof node === 'string') return change(node);
    if (!Array.isArray(node)) return node;
    const [name, kind, branches, ...rest] = node;
    if (!['select', 'plural', 'selectordinal'].includes(kind)) return node;
    return [
      name,
      kind,
      Object.fromEntries(
        Object.entries(branches).map(([key, branch]) => [
          key,
          translateTree(branch, change),
        ])
      ),
      ...rest,
    ];
  });
}

/** The children of a `<T>` with their text in another case. */
function translateJsx(children, change) {
  if (typeof children === 'string') return change(children);
  if (Array.isArray(children)) {
    return children.map((child) => translateJsx(child, change));
  }
  // A variable holds no text
  if (!children || typeof children !== 'object' || 'k' in children) {
    return children;
  }
  return {
    ...children,
    ...('c' in children && { c: translateJsx(children.c, change) }),
  };
}

const sortKeys = (object) =>
  Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1))
  );

for (const [locale, change] of Object.entries(CASES)) {
  const translations = sortKeys({
    ...Object.fromEntries(
      Object.entries(trees).map(([hash, tree]) => [
        hash,
        translateTree(tree, change),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(jsx).map(([hash, children]) => [
        hash,
        translateJsx(children, change),
      ])
    ),
  });
  writeFileSync(
    join(root, 'src', '_gt', `${locale}.json`),
    `${JSON.stringify(translations, null, 2)}\n`
  );
  console.log(`${locale}: ${Object.keys(translations).length} messages`);
}
