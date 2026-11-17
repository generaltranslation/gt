import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

// The packages an app imports `t`, `useGT()` or `getGT()` from
const RUNTIME_PACKAGES = [
  'gt-i18n',
  'gt-react',
  'gt-next',
  'gt-tanstack-start',
  'gt-react-native',
  'gt-node',
  '@generaltranslation/react-core',
];

// The module of the runtime that reads a precomputed message, and the export
// it has since it does
const RUNTIME_MODULE = 'gt-i18n/unstable/internal';
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

/**
 * Whether the GT runtime installed for the app at `root` reads the messages
 * this compiler precomputes: false when a runtime that does not is found,
 * true when every runtime found does, undefined when none is found. The
 * compiler is versioned apart from the runtime packages, and an older `t`
 * would return a tag function for a precomputed call.
 */
export function findPrecomputedMessageSupport(
  root: string
): boolean | undefined {
  const fromRoot = createRequire(path.join(root, 'package.json'));
  let found: boolean | undefined;
  for (const name of RUNTIME_PACKAGES) {
    let file: string;
    try {
      // gt-i18n is a dependency of the others, so it resolves from them
      const from =
        name === 'gt-i18n' ? fromRoot : createRequire(fromRoot.resolve(name));
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
