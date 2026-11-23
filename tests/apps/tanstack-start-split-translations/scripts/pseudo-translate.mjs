// Writes src/_gt/<locale>.json: every message of the app with its text in
// upper case for `fr` and in lower case for `de`, so a check can tell a
// locale's translation from the source and from the other locale.
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
    GT_SPLIT_TRANSLATIONS: 'false',
    CHECK_OUT_DIR: join(root, '.check', 'collect'),
    CHECK_MESSAGES: treesPath,
  },
});

const trees = JSON.parse(readFileSync(treesPath, 'utf8'));
const jsx = JSON.parse(readFileSync(jsxPath, 'utf8'));
rmSync(jsxPath);

// The msg() of the server function in src/routes/deferred.tsx is called with
// a string, which no build writes a call for: m() hashes it when it renders
for (const text of ['Checked by the server']) {
  trees[hashSource({ source: text, dataFormat: 'MESSAGE_TREE' })] ??= text;
}

// The entries of src/dictionary.ts, which gt-i18n looks up as ICU strings
for (const text of ['Hello from the dictionary', 'Looked up by its key']) {
  trees[hashSource({ source: text, dataFormat: 'ICU' })] ??= text;
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

for (const [locale, change] of Object.entries(CASES)) {
  const translations = Object.fromEntries(
    Object.entries({
      // Every message of the app is plain text
      ...Object.fromEntries(
        Object.entries(trees).map(([hash, text]) => [hash, change(text)])
      ),
      ...Object.fromEntries(
        Object.entries(jsx).map(([hash, children]) => [
          hash,
          translateJsx(children, change),
        ])
      ),
    }).sort(([a], [b]) => (a < b ? -1 : 1))
  );
  writeFileSync(
    join(root, 'src', '_gt', `${locale}.json`),
    `${JSON.stringify(translations, null, 2)}\n`
  );
  console.log(`${locale}: ${Object.keys(translations).length} messages`);
}
