import fs from 'node:fs';
import os from 'node:os';
import * as path from 'path';
import { afterAll, describe, test, expect, vi, beforeEach } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { createInlineUpdates } from '../createInlineUpdates.js';
import type { ParsingConfigOptions } from '../../../types/parsing.js';
import { Libraries, type GTLibrary } from '../../../types/libraries.js';
import type { Settings } from '../../../types/index.js';
import { writeMessageTranslations } from '../../../fs/writeMessageTranslations.js';
import {
  clearEmbeddedHashes,
  getEmbeddedHashes,
  recordLoadedHashes,
} from '../../../state/embeddedHashes.js';

vi.mock('../../../console/logging.js', () => ({
  logError: vi.fn(),
}));
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

const FIXTURE = path.join(__dirname, '__fixtures__/embedded-hashes/page.tsx');
const HELPER_FIXTURE = path.join(
  __dirname,
  '__fixtures__/embedded-hashes-helper/page.tsx'
);

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

const treeHash = (source: string | unknown[], context?: string) =>
  hashSource({
    source: source as string,
    context,
    dataFormat: 'MESSAGE_TREE',
  });

async function extract(
  file: string | string[],
  library: GTLibrary = Libraries.GT_NEXT
) {
  const { matchFiles } = await import('../../../fs/matchFiles.js');
  vi.mocked(matchFiles).mockReturnValue([file].flat());
  const result = await createInlineUpdates(
    library,
    false,
    undefined,
    {},
    parsingOptions
  );
  expect(result.errors).toHaveLength(0);
  return result;
}

beforeEach(() => {
  clearEmbeddedHashes();
});

describe('embedded hashes', () => {
  test('records <T> and unstable gt messages the compiler embeds', async () => {
    const { updates } = await extract(FIXTURE);
    const jsxHash = updates.find((update) => update.dataFormat === 'JSX')
      ?.metadata.hash;
    expect(jsxHash).toBeDefined();

    expect([...(getEmbeddedHashes(false) ?? [])].sort()).toEqual(
      [
        jsxHash,
        treeHash('Embedded string'),
        treeHash(['Hello, ', ['name'], '!'], 'greeting'),
      ].sort()
    );
  });

  test('leaves out entries that still load', async () => {
    const { updates } = await extract(FIXTURE);
    const embedded = getEmbeddedHashes(false);
    const loaded = updates
      .filter((update) => !embedded?.has(update.metadata.hash!))
      .map((update) => update.source);
    expect(loaded).toEqual(
      expect.arrayContaining([
        // msg(), a stable gt(), a configured tag, an anonymous value, a
        // __proto__ variable, a message an alias also uses, a closure that
        // precedes its gt declaration, a let gt, and a use before its import
        'Registered message',
        'Legacy string',
        'Save',
        ['You have ', ['_gt_1'], ' items'],
        // the compilers leave __proto__ keys to the runtime
        ['Proto ', ['__proto__']],
        'Shared text',
        'Earlier closure',
        'Let binding',
        'Before its import',
      ])
    );
  });

  test('keeps hashes that another extractor also loads', async () => {
    const { updates } = await extract(FIXTURE);
    const jsx = updates.find((update) => update.dataFormat === 'JSX')!;
    // gt-vue's merge replaces an update that shares its hash with a new object
    recordLoadedHashes([...updates, { ...jsx, metadata: { ...jsx.metadata } }]);
    expect([...(getEmbeddedHashes(false) ?? [])].sort()).toEqual(
      [
        treeHash('Embedded string'),
        treeHash(['Hello, ', ['name'], '!'], 'greeting'),
      ].sort()
    );
  });

  test('does not embed stable gt() or m() through a helper', async () => {
    await extract(HELPER_FIXTURE);
    expect([...(getEmbeddedHashes(false) ?? [])]).toEqual([]);
  });

  test('stays undefined when the scan finds no inline content', async () => {
    const { matchFiles } = await import('../../../fs/matchFiles.js');
    vi.mocked(matchFiles).mockReturnValue([]);

    await createInlineUpdates(
      Libraries.GT_NEXT,
      false,
      undefined,
      {},
      parsingOptions
    );
    expect(getEmbeddedHashes(false)).toBeUndefined();
  });

  test('is undefined until something is extracted', () => {
    recordLoadedHashes([
      { dataFormat: 'ICU', source: 'Vue only', metadata: { hash: 'vue' } },
    ]);
    expect(getEmbeddedHashes(false)).toBeUndefined();
  });
});
const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-msg-embedded-'));

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

/** Extracts `files` as one project; entries are labeled `<dataFormat> <source>`. */
async function extractProject(
  files: Record<string, string>,
  library: GTLibrary = Libraries.GT_NEXT,
  helpers = false
) {
  const dir = fs.mkdtempSync(path.join(projectRoot, 'project-'));
  const paths = Object.entries(files).map(([name, code]) => {
    fs.writeFileSync(path.join(dir, name), code);
    return path.join(dir, name);
  });
  const { updates, warnings } = await extract(paths, library);
  const embedded = getEmbeddedHashes(helpers);
  const labels = (isEmbedded: boolean) =>
    updates
      .filter((update) => embedded?.has(update.metadata.hash!) === isEmbedded)
      .map(({ dataFormat, source }) =>
        [
          dataFormat,
          typeof source === 'string' ? source : JSON.stringify(source),
        ].join(' ')
      );
  return { warnings, embedded: labels(true), loaded: labels(false) };
}

describe('msg() entries stay loaded', () => {
  test.each([
    ['gt-next', Libraries.GT_NEXT, 'ICU'],
    ['gt-react', Libraries.GT_REACT, 'ICU'],
    ['gt-i18n', Libraries.GT_I18N, 'ICU'],
    ['gt-node', Libraries.GT_NODE, 'ICU'],
    ['gt-tanstack-start', Libraries.GT_TANSTACK_START, 'ICU'],
    ['gt-react-native', Libraries.GT_REACT_NATIVE, 'ICU'],
    ['gt-next/unstable', Libraries.GT_NEXT, 'MESSAGE_TREE'],
    ['gt-next/unstable/server', Libraries.GT_NEXT, 'MESSAGE_TREE'],
    ['gt-react/unstable', Libraries.GT_REACT, 'MESSAGE_TREE'],
    ['gt-i18n/unstable', Libraries.GT_I18N, 'MESSAGE_TREE'],
    ['gt-node/unstable', Libraries.GT_NODE, 'MESSAGE_TREE'],
    ['gt-tanstack-start/unstable', Libraries.GT_TANSTACK_START, 'MESSAGE_TREE'],
    ['gt-react-native/unstable', Libraries.GT_REACT_NATIVE, 'MESSAGE_TREE'],
    [
      '@generaltranslation/react-core/unstable',
      Libraries.GT_REACT_CORE,
      'MESSAGE_TREE',
    ],
  ] as const)('msg from %s', async (source, library, format) => {
    const result = await extractProject(
      {
        'page.ts': `import { msg } from '${source}';\nexport const label = msg('Text');\n`,
      },
      library
    );
    expect(result.warnings).toEqual([]);
    expect(result.embedded).toEqual([]);
    expect(result.loaded).toEqual([`${format} Text`]);
  });

  test('classifies aliased imports by their imported name', async () => {
    const result = await extractProject({
      'page.ts': `import { msg as m } from 'gt-next';
import { msg as t, t as msg } from 'gt-react/unstable';
export const stable = m('Aliased stable');
export const msgNamedT = t\`Msg named t\`;
export const tNamedMsg = msg\`T named msg\`;
`,
    });
    expect(result.embedded).toEqual(['MESSAGE_TREE T named msg']);
    expect(result.loaded).toEqual([
      'ICU Aliased stable',
      'MESSAGE_TREE Msg named t',
    ]);
  });

  test('msg with options, variables, arrays, objects and configured tags', async () => {
    const result = await extractProject({
      'page.tsx': `import { msg } from 'gt-next';
import { msg as treeMsg } from 'gt-next/unstable';
const name = 'Ada';
declare const count: number;
export const options = msg('Option', { $context: 'menu', $id: 'option.id', $maxChars: 12 });
export const variable = msg('Hello, {name}!', { name });
export const list = [msg('First'), treeMsg\`Second\`];
export const byKey = { save: msg('Save'), arrayArg: msg(['One', 'Two']) };
export const treeOptions = treeMsg({ context: 'menu', maxChars: 12, requiresReview: true })\`Tree option\`;
export const named = treeMsg\`Hi, \${{ name }}!\`;
export const anonymous = treeMsg\`You have \${count} items\`;
const configured = treeMsg({ context: 'button' });
const alias = treeMsg;
export const tags = [configured\`Configured\`, alias\`Aliased\`];
`,
    });
    expect(result.embedded).toEqual([]);
    expect(result.loaded).toEqual([
      'ICU Option',
      'ICU Hello, {name}!',
      'ICU First',
      'ICU Save',
      'ICU One',
      'ICU Two',
      'MESSAGE_TREE Second',
      'MESSAGE_TREE Tree option',
      'MESSAGE_TREE ["Hi, ",["name"],"!"]',
      'MESSAGE_TREE ["You have ",["_gt_1"]," items"]',
      'MESSAGE_TREE Configured',
      'MESSAGE_TREE Aliased',
    ]);
  });

  test.each(
    ['page.ts', 'page.tsx', 'page.js', 'page.jsx'].flatMap((file) => [
      [file, ''],
      [file, "'use client';\n"],
    ])
  )('in %s with directive %j', async (file, directive) => {
    const result = await extractProject(
      {
        [file]: `${directive}import { msg } from 'gt-react';
import { msg as treeMsg, t } from 'gt-react/unstable';
export const top = [msg('Top level'), treeMsg\`Tree top level\`];
export function Component() {
  return [msg('In component'), treeMsg('Tree in component'), t\`Embedded\`];
}
`,
      },
      Libraries.GT_REACT
    );
    expect(result.embedded).toEqual(['MESSAGE_TREE Embedded']);
    expect(result.loaded).toEqual([
      'ICU Top level',
      'ICU In component',
      'MESSAGE_TREE Tree top level',
      'MESSAGE_TREE Tree in component',
    ]);
  });

  test('keeps a message msg shares with embedded t', async () => {
    const result = await extractProject({
      'page.ts': `import { msg, t } from 'gt-react/unstable';
declare const name: string;
export const shared = [
  msg\`Shared text\`,
  msg('Shared call'),
  msg({ context: 'menu', maxChars: 12 })\`Shared option\`,
  msg\`Hello, \${{ name }}!\`,
];
export const embedded = [
  t\`Shared text\`,
  t\`Shared call\`,
  t({ context: 'menu', maxChars: 12 })\`Shared option\`,
  t\`Hello, \${{ name }}!\`,
  t\`Only embedded\`,
];
`,
    });
    expect(result.embedded).toEqual(['MESSAGE_TREE Only embedded']);
    expect(result.loaded).toEqual([
      'MESSAGE_TREE Shared text',
      'MESSAGE_TREE Shared call',
      'MESSAGE_TREE Shared option',
      'MESSAGE_TREE ["Hello, ",["name"],"!"]',
    ]);
  });

  test.each([[['messages.ts', 'page.tsx']], [['page.tsx', 'messages.ts']]])(
    'keeps msg shared with gt in another file (%j)',
    async (order) => {
      const files: Record<string, string> = {
        'messages.ts': `import { msg } from 'gt-next/unstable';
export const greeting = msg\`Welcome back\`;
`,
        'page.tsx': `'use client';
import { useGT, useMessages } from 'gt-next/unstable';
import { greeting } from './messages';
export function Page() {
  const gt = useGT();
  const m = useMessages();
  return <p>{gt\`Welcome back\`}{m(greeting)}{gt\`Page title\`}</p>;
}
`,
      };
      const result = await extractProject(
        Object.fromEntries(order.map((file) => [file, files[file]]))
      );
      expect(result.embedded).toEqual(['MESSAGE_TREE Page title']);
      expect(result.loaded).toEqual(['MESSAGE_TREE Welcome back']);
    }
  );

  test('keeps msg() that shares text with <T> or stable gt()', async () => {
    const result = await extractProject({
      'page.tsx': `import { T, msg, useGT } from 'gt-next';
export const shared = msg('Shared text');
export function Page() {
  const gt = useGT();
  return <><T>Shared text</T>{gt('Shared text')}{gt('Only gt')}</>;
}
`,
    });
    expect(result.embedded).toEqual(['JSX Shared text']);
    expect(result.loaded).toEqual(['ICU Shared text', 'ICU Only gt']);
  });

  test('keeps msg() looked up with useMessages() and getMessages()', async () => {
    const result = await extractProject({
      'page.tsx': `import { msg, useMessages } from 'gt-next';
import { getMessages } from 'gt-next/server';
const greeting = msg('Encoded greeting');
export function Client() {
  const m = useMessages();
  return <p>{m(greeting)}{m(msg('Inline encoded'))}</p>;
}
export async function Server() {
  const m = await getMessages();
  return m(greeting);
}
`,
    });
    expect(result.embedded).toEqual([]);
    expect(result.loaded).toEqual([
      'ICU Encoded greeting',
      'ICU Inline encoded',
    ]);
  });

  test('ignores msg functions that are not gt', async () => {
    const result = await extractProject({
      'page.tsx': `import { msg as otherMsg } from 'other-i18n';
import { T, msg } from 'gt-next';
function local() {
  const msg = (text: string) => text;
  return msg('Shadowed local');
}
export const other = otherMsg('Other library');
export const real = msg('Real message');
export const element = <T>Embedded</T>;
`,
      'local.ts': `export function msg(text: string | TemplateStringsArray) {
  return text;
}
export const value = [msg('Local function'), msg\`Local tag\`];
`,
    });
    expect(result.embedded).toEqual(['JSX Embedded']);
    expect(result.loaded).toEqual(['ICU Real message']);
  });

  test('does not follow namespace imports or local re-exports', async () => {
    const result = await extractProject({
      'i18n.ts': `export { msg } from 'gt-next';
export { msg as treeMsg } from 'gt-next/unstable';
`,
      'page.tsx': `import * as stable from 'gt-next';
import * as unstable from 'gt-next/unstable';
import { msg, treeMsg } from './i18n';
import { T } from 'gt-next';
export const a = [stable.msg('Namespace'), unstable.msg\`Namespace tree\`];
export const b = [msg('Re-exported'), treeMsg\`Re-exported tree\`];
export const element = <T>Embedded</T>;
`,
    });
    expect(result.embedded).toEqual(['JSX Embedded']);
    expect(result.loaded).toEqual([]);
  });

  test('writes exactly the msg() and unextracted entries to msgOutput', async () => {
    const fixture = path.join(__dirname, '__fixtures__/msg-output');
    const { updates } = await extract(
      ['messages.ts', 'page.tsx', 'server.ts'].map((file) =>
        path.join(fixture, file)
      )
    );
    const dir = fs.mkdtempSync(path.join(projectRoot, 'output-'));
    const translations: Record<string, string> = { dictionary: 'Dictionnaire' };
    for (const { metadata, source } of updates) {
      translations[metadata.hash!] = `fr ${JSON.stringify(source)}`;
    }
    expect(Object.keys(translations)).toHaveLength(7);
    fs.writeFileSync(path.join(dir, 'fr.json'), JSON.stringify(translations));

    await writeMessageTranslations({
      files: {
        placeholderPaths: { gt: path.join(dir, '[locale].json') },
        gtJson: {
          inlineTranslations: {
            locales: ['fr'],
            msgOutput: path.join(dir, '[locale].msg.json'),
          },
          parsingFlags: {},
        },
      },
    } as unknown as Settings);

    expect(
      JSON.parse(fs.readFileSync(path.join(dir, 'fr.msg.json'), 'utf8'))
    ).toEqual({
      dictionary: 'Dictionnaire',
      [treeHash('Welcome back')]: 'fr "Welcome back"',
      [treeHash('Settings', 'menu')]: 'fr "Settings"',
      [hashSource({ source: 'Saved', dataFormat: 'ICU' })]: 'fr "Saved"',
    });
  });
});

describe('messages that use helpers', () => {
  const PLURAL = "plural({ count }, { one: 'One file', other: 'Many files' })";
  const PLURAL_TREE =
    'MESSAGE_TREE [["count","plural",{"one":"One file","other":"Many files"}]]';
  const files = {
    'page.ts': `import { t, msg, plural, part } from 'gt-react/unstable';
declare const count: number, name: string;
export const helper = () => t\`\${${PLURAL}}\`;
export const named = () => t\`Hello, \${{ name }}!\`;
export const text = () => t\`Save\`;
export const sharedWithPart = () => [t\`Close\`, t\`\${part\`Close\`}\`];
`,
  };

  test('are embedded with files.gt.inlineTranslations.helpers', async () => {
    const result = await extractProject(files, Libraries.GT_REACT, true);
    expect(result.embedded).toEqual([
      PLURAL_TREE,
      'MESSAGE_TREE ["Hello, ",["name"],"!"]',
      'MESSAGE_TREE Save',
      'MESSAGE_TREE Close',
    ]);
    expect(result.loaded).toEqual([]);
  });

  test('stay loaded without it, with every message one of them shares', async () => {
    const result = await extractProject(files, Libraries.GT_REACT);
    expect(result.embedded).toEqual([
      'MESSAGE_TREE ["Hello, ",["name"],"!"]',
      'MESSAGE_TREE Save',
    ]);
    // t`Close` is embedded either way, but the part that shares its hash is not
    expect(result.loaded).toEqual([PLURAL_TREE, 'MESSAGE_TREE Close']);
  });

  test.each([
    [
      'msg',
      `import { msg, plural } from 'gt-react/unstable';
declare const count: number;
export const shared = msg\`\${${PLURAL}}\`;
`,
    ],
    [
      'a branch behind a constant',
      `import { t, plural, part } from 'gt-react/unstable';
declare const count: number;
const many = part\`Many files\`;
export const shared = () => t\`\${plural({ count }, { one: 'One file', other: many })}\`;
`,
    ],
    [
      'a tag alias',
      `import { t, plural } from 'gt-react/unstable';
declare const count: number;
const translate = t;
export const shared = () => translate\`\${${PLURAL}}\`;
`,
    ],
  ])(
    'stay loaded when %s shares their hash, with helpers on',
    async (_name, other) => {
      const result = await extractProject(
        { 'page.ts': files['page.ts'], 'other.ts': other },
        Libraries.GT_REACT,
        true
      );
      expect(result.loaded).toContain(PLURAL_TREE);
      expect(result.embedded).not.toContain(PLURAL_TREE);
      expect(result.embedded).toContain('MESSAGE_TREE Save');
    }
  );
});

describe('<T> is embedded only from sources every compiler tracks', () => {
  test.each([
    ['gt-next', Libraries.GT_NEXT, true],
    ['gt-next/server', Libraries.GT_NEXT, true],
    ['gt-react', Libraries.GT_NEXT, false],
    ['gt-next/client', Libraries.GT_NEXT, false],
    ['@generaltranslation/react-core', Libraries.GT_NEXT, false],
    ['gt-react', Libraries.GT_REACT, true],
    ['gt-tanstack-start', Libraries.GT_TANSTACK_START, true],
    ['gt-react-native', Libraries.GT_REACT_NATIVE, false],
  ] as const)('<T> from %s in a %s app', async (source, library, embedded) => {
    const result = await extractProject(
      {
        'page.tsx': `import { T } from '${source}';\nexport const page = <T>Hello</T>;\n`,
      },
      library
    );
    expect(result.embedded).toEqual(embedded ? ['JSX Hello'] : []);
    expect(result.loaded).toEqual(embedded ? [] : ['JSX Hello']);
  });
});
