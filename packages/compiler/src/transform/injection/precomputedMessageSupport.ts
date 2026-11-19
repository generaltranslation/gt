import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

// The packages an app imports `t`, `useGT()` or `getGT()` from, each by an
// entry it has: @generaltranslation/react-core has no root entry
const RUNTIME_ENTRIES = [
  'gt-i18n',
  'gt-react',
  'gt-next',
  'gt-tanstack-start',
  'gt-react-native',
  'gt-node',
  '@generaltranslation/react-core/pure',
];

// The module of the runtime that reads a precomputed message, and the export
// it has since it does
const RUNTIME_MODULE = 'gt-i18n/internal';
const RUNTIME_EXPORT = 'isPrecomputedMessage';

export const PRECOMPUTED_MESSAGES_UNSUPPORTED_WARNING = createDiagnosticMessage(
  {
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened:
      'The installed GT runtime is older than this compiler and does not read precomputed messages',
    reassurance:
      'Templates keep their tagged form, which that runtime renders as before',
    fix: 'Update the GT packages together, or set precomputeMessages: false to silence this warning',
  }
);

export const createRuntimeNotFoundWarning = (directory: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `Build-time message trees are off for the files in ${directory}`,
    why: 'no gt-i18n runtime was found from that directory, so the compiler cannot tell whether it reads precomputed messages; this is said once per build, for the first such directory',
    reassurance: 'Templates keep their tagged form',
    fix: 'Set precomputeMessages: true to precompute them anyway, or false to silence this warning',
  });

/**
 * Whether the GT runtime that code in `root` resolves reads the messages this
 * compiler precomputes: false when a runtime that does not is found, true
 * when every runtime found does, undefined when none is found. The compiler
 * is versioned apart from the runtime packages, and an older `t` would return
 * a tag function for a precomputed call.
 */
export function findPrecomputedMessageSupport(
  root: string
): boolean | undefined {
  const fromRoot = createRequire(path.join(root, 'package.json'));
  let found: boolean | undefined;
  for (const entry of RUNTIME_ENTRIES) {
    let file: string;
    try {
      // gt-i18n is a dependency of the others, so it resolves from them
      const from =
        entry === 'gt-i18n' ? fromRoot : createRequire(fromRoot.resolve(entry));
      file = from.resolve(RUNTIME_MODULE);
    } catch {
      // Not installed, or not resolvable from here
      continue;
    }
    if (!fs.readFileSync(file, 'utf8').includes(RUNTIME_EXPORT)) return false;
    found = true;
  }
  return found;
}

/**
 * findPrecomputedMessageSupport for the directory of each file a build
 * compiles, asked once per directory. A directory without `node_modules`
 * resolves what its parent does.
 */
export function createPrecomputedMessageSupport(): (
  directory: string
) => boolean | undefined {
  const found = new Map<string, boolean | undefined>();
  const find = (directory: string): boolean | undefined => {
    if (found.has(directory)) return found.get(directory);
    const parent = path.dirname(directory);
    const support =
      parent !== directory &&
      !fs.existsSync(path.join(directory, 'node_modules'))
        ? find(parent)
        : findPrecomputedMessageSupport(directory);
    found.set(directory, support);
    return support;
  };
  return find;
}
