// Writes src/_gt/fr.json: every message of the app with its text in upper
// case, so a check can tell a translation from the source.
//
// The messages are read from a build of the app, where the compiler has
// computed each hash: `<T>` sources from its debug hash manifest, and `t`
// and `msg` messages from the calls it writes into each module.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashSource } from 'generaltranslation/id';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const treesPath = join(root, '.check', 'messages.json');
const jsxPath = join(root, '_gt_debug_hash_manifest.json');

execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'warn'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    GT_SPLIT_TRANSLATIONS: 'false',
    CHECK_OUT_DIR: join(root, '.check', 'collect'),
    CHECK_MESSAGES: treesPath,
  },
});

const trees = JSON.parse(readFileSync(treesPath, 'utf8'));
const jsx = JSON.parse(readFileSync(jsxPath, 'utf8'));
rmSync(jsxPath);

// The entries of src/dictionary.ts, which gt-i18n looks up as ICU strings
for (const text of ['Words from the dictionary', 'Found by its key']) {
  trees[hashSource({ source: text, dataFormat: 'ICU' })] ??= text;
}

/** The children of a `<T>` with their text in upper case. */
function translateJsx(children) {
  if (typeof children === 'string') return children.toUpperCase();
  if (Array.isArray(children)) return children.map(translateJsx);
  // A variable holds no text
  if (!children || typeof children !== 'object' || 'k' in children) {
    return children;
  }
  return {
    ...children,
    ...('c' in children && { c: translateJsx(children.c) }),
  };
}

const translations = Object.fromEntries(
  Object.entries({
    // Every message of the app is plain text
    ...Object.fromEntries(
      Object.entries(trees).map(([hash, text]) => [hash, text.toUpperCase()])
    ),
    ...Object.fromEntries(
      Object.entries(jsx).map(([hash, children]) => [
        hash,
        translateJsx(children),
      ])
    ),
  }).sort(([a], [b]) => (a < b ? -1 : 1))
);
writeFileSync(
  join(root, 'src', '_gt', 'fr.json'),
  `${JSON.stringify(translations, null, 2)}\n`
);
console.log(`fr: ${Object.keys(translations).length} messages`);
