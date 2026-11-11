import fs from 'node:fs/promises';
import path from 'node:path';
import { compileCatalog } from '@inlang/paraglide-js';

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
 * Writes a project under `__tests__/plugins/.tmp/<name>` (inside the package, so
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
  for (const [file, content] of Object.entries(all)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  return root;
}

type Metadata = Record<
  string,
  { sourceCode?: Record<string, { target: string }[]> }
>;

/** A metadata file under `root`; `{}` if it was not written. */
export async function readMetadata(
  root: string,
  file = 'messages/en.metadata.json'
): Promise<Metadata> {
  const content = await fs
    .readFile(path.join(root, file), 'utf8')
    .catch(() => '{}');
  return JSON.parse(content);
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
