import fs from 'node:fs/promises';
import path from 'node:path';
import { compileCatalog } from '@inlang/paraglide-js';
import {
  collectContext,
  type CollectContextOptions,
} from '../../src/compiler/context.js';
import { writeFiles } from './files.js';

/** A message with one English text, as Paraglide's compiler takes it. */
const bundle = (id: string) => ({
  id,
  declarations: [],
  messages: [
    {
      id: `${id}_en`,
      bundleId: id,
      locale: 'en',
      selectors: [],
      variants: [
        {
          id: `${id}_en_v`,
          messageId: `${id}_en`,
          matches: [],
          pattern: [{ type: 'text', value: 'Hi' }],
        },
      ],
    },
  ],
});

/** The files of a Paraglide outdir that defines the messages `ids`. */
export function compileMessages(
  ids: readonly string[]
): Promise<Record<string, string>> {
  return compileCatalog({
    catalog: {
      settings: { baseLocale: 'en', locales: ['en'] },
      bundles: ids.map(bundle),
    } as never,
    compilerOptions: { outputStructure: 'message-modules' },
  });
}

/** `files` under `directory`, e.g. an outdir's under `src/paraglide`. */
export function filesIn(
  directory: string,
  files: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([file, content]) => [
      `${directory}/${file}`,
      content,
    ])
  );
}

/** A Paraglide outdir with one message, `greeting`. */
export const outdir: Record<string, string> = await compileMessages([
  'greeting',
]);

/** The inlang project `outdir` stands for: `messages/en.json` defines `greeting`. */
export const inlangProject: Record<string, string> = {
  'project.inlang/settings.json': JSON.stringify({
    baseLocale: 'en',
    locales: ['en'],
    'plugin.inlang.messageFormat': { pathPattern: './messages/{locale}.json' },
  }),
  'messages/en.json': JSON.stringify({ greeting: 'Hi' }),
};

/**
 * Writes a project under `__tests__/helpers/.tmp/<name>` (inside the package, so
 * `@inlang/paraglide-js` resolves from the outdir) with a compiled outdir at
 * `src/paraglide` and its inlang project. Returns its root.
 */
export async function writeProject(
  name: string,
  files: Record<string, string>
): Promise<string> {
  const root = path.join(import.meta.dirname, '.tmp', name);
  await fs.rm(root, { recursive: true, force: true });
  const all = {
    // Its own repository, as an app is: this repo's .gitignore (`.tmp`) does not apply.
    '.git/HEAD': 'ref: refs/heads/main\n',
    'package.json': `{ "name": "app", "type": "module" }`,
    ...inlangProject,
    ...filesIn('src/paraglide', outdir),
    ...files,
  };
  await writeFiles(root, all);
  return root;
}

/** What analyzing a project gave: the snippets of `greeting`, and what was logged. */
export type Collected = {
  usages: string[];
  warnings: string[];
  info: string[];
};

/** Analyzes the project at `root`, as the CLI does. `options.root` can be a directory in it. */
export async function collect(
  root: string,
  options: CollectContextOptions = {}
): Promise<Collected> {
  const warnings: string[] = [];
  const info: string[] = [];
  await collectContext({
    root,
    ...options,
    logger: {
      warn: (message) => void warnings.push(message),
      info: (message) => void info.push(message),
    },
  });
  return { usages: await readSnippets(root), warnings, info };
}

type Metadata = Record<
  string,
  { sourceCode?: Record<string, { target: string }[]> }
>;

/** A metadata file under `root`; `{}` if it was not written or is not JSON. */
export async function readMetadata(
  root: string,
  file = 'messages/en.metadata.json'
): Promise<Metadata> {
  return fs
    .readFile(path.join(root, file), 'utf8')
    .then((content) => JSON.parse(content) as Metadata)
    .catch(() => ({}));
}

/** The snippets of a message in a metadata file, as `file: target lines`. */
export async function readSnippets(
  root: string,
  { message = 'greeting', file = 'messages/en.metadata.json' } = {}
): Promise<string[]> {
  const metadata = await readMetadata(root, file);
  return Object.entries(metadata[message]?.sourceCode ?? {}).flatMap(
    ([source, snippets]) =>
      snippets.map((snippet) => `${source}: ${snippet.target}`)
  );
}

export const useGreeting = (from: string) =>
  `import { m } from "${from}";\nexport const text = m.greeting();\n`;

/** The snippet `useGreeting` gives `file`. */
export const greetingIn = (file: string) =>
  `${file}: export const text = m.greeting();`;
