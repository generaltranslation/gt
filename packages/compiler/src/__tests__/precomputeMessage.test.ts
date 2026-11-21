/**
 * Precomputed messages: a static `t` template becomes a call that
 * passes its message, built at compile time and written at the call. The
 * equivalence table compiles each case with and without `precomputeMessages`
 * and renders both in gt-react: the output must match.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { hashSource } from 'generaltranslation/id';
import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import {
  compileJsx,
  evaluateModule,
  loadGTRuntime,
  type GTRuntime,
} from './gtReactHarness';
import { findPrecomputedMessageSupport } from '../transform/injection/precomputedMessageSupport';
import { transformWithPlugin } from './transformWithPlugin';

const HELPERS =
  't, m, msg, useGT, plural, ordinal, select, number, date, time, part, derive, n';

const module = (body: string) =>
  `import { ${HELPERS} } from 'gt-react';\n${body}\n`;

// The files compiled here resolve no GT runtime, so the option is set
const PRECOMPUTE = { precomputeMessages: true };

// Generated code keeps source lines, which breaks lines inside a message.
const compile = async (body: string) =>
  (await transformWithPlugin(PRECOMPUTE, module(body)))?.replace(/\s+/g, ' ') ??
  null;

const hashOf = (source: unknown, metadata: Record<string, unknown> = {}) =>
  hashSource({
    source: source as string,
    dataFormat: 'MESSAGE_TREE',
    ...metadata,
  });

// A thrown transform error is logged and returns null; fail on it.
const consoleError = vi.spyOn(console, 'error');
afterEach(() => {
  const { calls } = consoleError.mock;
  consoleError.mockClear();
  expect(calls).toEqual([]);
});

describe('emitted messages', () => {
  it.each([
    [
      'literal options',
      "t({ context: 'greeting', maxChars: -8, requiresReview: true })`Hello, ${{ name }}!`;",
      '{ $_hash: "#", $_tree: ["Hello, ", ["name"], "!"], context: "greeting", maxChars: -8, requiresReview: true }',
      't(@, { name });',
      ['Hello, ', ['name'], '!'],
      { context: 'greeting', maxChars: -8, requiresReview: true },
    ],
    [
      'named variables, whose values may be any expression',
      't`Hello, ${{ name }}! Card ${{ card: data.card }}`;',
      '{ $_hash: "#", $_tree: ["Hello, ", ["name"], "! Card ", ["card"]] }',
      't(@, { name, card: data.card });',
      ['Hello, ', ['name'], '! Card ', ['card']],
      {},
    ],
    [
      'values without a name, numbered in tree order',
      "const total = 3;\nt`${total} of ${total + 1}: ${select({ role }, { b: part`${'B'}`, a: part`${'A'}` })}`;",
      '{ $_hash: "#", $_tree: [["_gt_1"], " of ", ["_gt_2"], ": ", ["role", "select", { a: [["_gt_3"]], b: [["_gt_4"]], other: "" }]] }',
      // Evaluated in source order, where b comes before a.
      "t(@, { _gt_1: total, _gt_2: total + 1, role, _gt_4: 'B', _gt_3: 'A' });",
      [
        ['_gt_1'],
        ' of ',
        ['_gt_2'],
        ': ',
        ['role', 'select', { a: [['_gt_3']], b: [['_gt_4']], other: '' }],
      ],
      {},
    ],
    [
      'plural with part and n',
      't`${plural({ count }, { one: part`${n} item`, other: part`${n} items for ${{ name }}` })}`;',
      '{ $_hash: "#", $_tree: [["count", "plural", { one: [0, " item"], other: [0, " items for ", ["name"]] }]] }',
      't(@, { count, name });',
      [
        [
          'count',
          'plural',
          { one: [0, ' item'], other: [0, ' items for ', ['name']] },
        ],
      ],
      {},
    ],
    [
      'ordinal',
      't`${ordinal({ place }, { one: part`${n}st`, other: part`${n}th` })}`;',
      '{ $_hash: "#", $_tree: [["place", "selectordinal", { one: [0, "st"], other: [0, "th"] }]] }',
      't(@, { place });',
      [['place', 'selectordinal', { one: [0, 'st'], other: [0, 'th'] }]],
      {},
    ],
    [
      'select',
      "t`${select({ role }, { admin: 'Admin', other: 'User' })}`;",
      '{ $_hash: "#", $_tree: [["role", "select", { admin: "Admin", other: "User" }]] }',
      't(@, { role });',
      [['role', 'select', { admin: 'Admin', other: 'User' }]],
      {},
    ],
    [
      'number with a literal formatting context',
      "t`Total ${number({ price }, { style: 'currency', maximumFractionDigits: 0, currency: 'USD' })}`;",
      '{ $_hash: "#", $_tree: ["Total ", ["price", "number", "currency"]], $_formats: { price: { currency: \'USD\', maximumFractionDigits: 0 } } }',
      't(@, { price });',
      ['Total ', ['price', 'number', 'currency']],
      {},
    ],
    [
      'date and time with a formatting context read at runtime',
      "t`Due ${date({ due }, { style: 'medium', timeZone })} at ${time({ at: due }, { style: 'short', timeZone: zones.user })}`;",
      '{ $_hash: "#", $_tree: ["Due ", ["due", "date", "medium"], " at ", ["at", "time", "short"]] }',
      't(@, { due, at: due }, { due: { timeZone }, at: { timeZone: zones.user } });',
      ['Due ', ['due', 'date', 'medium'], ' at ', ['at', 'time', 'short']],
      {},
    ],
    [
      'a formatting context with a side effect, which keeps its place',
      "t`${{ name: user.name }}: ${number({ price }, { style: 'currency', currency: next() })}`;",
      '{ $_hash: "#", $_tree: [["name"], ": ", ["price", "number", "currency"]] }',
      't(@, { name: user.name, price }, { price: { currency: next() } });',
      [['name'], ': ', ['price', 'number', 'currency']],
      {},
    ],
    [
      'a variable repeated with the same value',
      't`${{ name }} and ${{ name }}`;',
      '{ $_hash: "#", $_tree: [["name"], " and ", ["name"]] }',
      't(@, { name });',
      [['name'], ' and ', ['name']],
      {},
    ],
  ])('precomputes %s', async (_name, body, message, call, tree, metadata) => {
    const output = await compile(body);
    const built = message.replace('#', hashOf(tree, metadata));
    expect(output).toContain(call.replace('@', built));
    expect(output).not.toContain('_gt =');
  });

  it.each([
    ['text', 't`Save`;', 't({ $_hash: "#", $_tree: "Save" });', {}],
    [
      'text with literal options',
      "t({ context: 'button', maxChars: -8, requiresReview: true })`Save`;",
      't({ $_hash: "#", $_tree: "Save", context: "button", maxChars: -8, requiresReview: true });',
      { context: 'button', maxChars: -8, requiresReview: true },
    ],
  ])('precomputes %s', async (_name, body, call, metadata) => {
    const output = await compile(body);
    expect(output).toContain(call.replace('#', hashOf('Save', metadata)));
  });

  it('precomputes the templates of useGT() and getGT()', async () => {
    const output = await transformWithPlugin(
      PRECOMPUTE,
      `import { useGT } from 'gt-react';
import { getGT } from 'gt-next/server';
export function Label({ name }) {
  const gt = useGT();
  return gt\`Hello, \${{ name }}!\`;
}
export async function load() {
  const t = await getGT();
  return t\`Save\`;
}`
    );
    expect(output).toContain(
      `return gt({ $_hash: "${hashOf(['Hello, ', ['name'], '!'])}", $_tree: ["Hello, ", ["name"], "!"] }, { name });`
    );
    expect(output).toContain(
      `return t({ $_hash: "${hashOf('Save')}", $_tree: "Save" });`
    );
  });

  it('declares nothing at module scope', async () => {
    const output = await transformWithPlugin(
      PRECOMPUTE,
      `import { t } from 'gt-react';
export const labels = (a, b) => [t\`Hi \${{ a }}\`, t\`Bye \${{ b }}\`, t\`Hi \${{ a: b }}\`];`
    );
    const message = (tree: unknown) =>
      `{ $_hash: "${hashOf(tree)}", $_tree: ${JSON.stringify(tree).replaceAll(',', ', ')} }`;
    expect(output).toBe(
      `import { t } from 'gt-react';
export const labels = (a, b) => [t(${message(['Hi ', ['a']])}, { a }), t(${message(['Bye ', ['b']])}, { b }), t(${message(['Hi ', ['a']])}, { a: b })];`
    );
  });

  describe('a message that is read before its module has run', () => {
    // t, as the runtime reads the two forms the compiler emits
    const STUB = `export const t = (first, values) =>
  first.$_tree !== undefined
    ? first.$_tree.map((node) => (typeof node === 'string' ? node : values[node[0]])).join('')
    : (strings, ...holes) => strings.map((text, i) => text + (i < holes.length ? Object.values(holes[i])[0] : '')).join('');`;
    // b's functions are called by a, which b imports, before b's body runs
    const CYCLE = {
      'b.mjs': `import { t } from 'gt-react';
import './a.mjs';
export function label(name) { return t\`Hi \${{ name }}\`; }`,
      'a.mjs': `import { label } from './b.mjs';
export const title = label('Ada');`,
      'entry.mjs': `import './b.mjs';
export { title } from './a.mjs';`,
    };

    const writeModules = async (modules: Record<string, string>) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-precompute-'));
      onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
      fs.writeFileSync(path.join(dir, 'gt.mjs'), STUB);
      for (const [file, code] of Object.entries(modules)) {
        const compiled = (await transformWithPlugin(PRECOMPUTE, code)) ?? code;
        fs.writeFileSync(
          path.join(dir, file),
          compiled.replace(/(['"])gt-react\1/, "'./gt.mjs'")
        );
      }
      return dir;
    };

    it('renders through an import cycle, as modules', async () => {
      const dir = await writeModules(CYCLE);
      expect(fs.readFileSync(path.join(dir, 'b.mjs'), 'utf8')).toContain(
        't({ $_hash: '
      );
      const { title } = await import(
        /* @vite-ignore */ pathToFileURL(path.join(dir, 'entry.mjs')).href
      );
      expect(title).toBe('Hi Ada');
    });

    it('renders through an import cycle, in a bundle', async () => {
      const dir = await writeModules(CYCLE);
      const { outputFiles } = await build({
        entryPoints: [path.join(dir, 'entry.mjs')],
        bundle: true,
        minify: true,
        write: false,
        format: 'esm',
      });
      const bundle = path.join(dir, 'bundle.mjs');
      fs.writeFileSync(bundle, outputFiles[0].text);
      const { title } = await import(
        /* @vite-ignore */ pathToFileURL(bundle).href
      );
      expect(title).toBe('Hi Ada');
    });

    it('renders at module level above a later import', async () => {
      const dir = await writeModules({
        'entry.mjs': `import { t } from 'gt-react';
export const title = t\`Hello \${{ name: 'Ada' }}\`;
import { other } from './other.mjs';
export { other };`,
        'other.mjs': 'export const other = 1;',
      });
      const { title } = await import(
        /* @vite-ignore */ pathToFileURL(path.join(dir, 'entry.mjs')).href
      );
      expect(title).toBe('Hello Ada');
    });
  });

  it.each([
    ['a msg template', 'msg`Save`;', 'msg({ $_hash: "#" })`Save`'],
    [
      'a name bound to two values',
      't`${{ name }} / ${{ name: other }}`;',
      't({ $_hash: "#" })`${{ name }} / ${{ name: other }}`',
    ],
    [
      'a repeated value with a side effect',
      't`${{ id: next() }} / ${{ id: next() }}`;',
      't({ $_hash: "#" })`${{ id: next() }} / ${{ id: next() }}`',
    ],
    [
      'a variable formatted twice',
      "t`${number({ price })} or ${number({ price }, { currency: 'USD' })}`;",
      't({ $_hash: "#" })`${number({ price })}',
    ],
    [
      'a formatting context that a value with a side effect could change',
      "t`${number({ price }, { style: 'currency', currency })} for ${{ name: next() }}`;",
      't({ $_hash: "#" })`${number({ price }',
    ],
    [
      'a formatting context that is read before a value that is not a variable',
      "t`${number({ price }, { style: 'currency', currency })} for ${{ name: user.name }}`;",
      't({ $_hash: "#" })`${number({ price }',
    ],
    [
      'a repeated value that is not a variable',
      't`${{ name: user.name }} / ${{ name: user.name }}`;',
      't({ $_hash: "#" })`${{ name: user.name }} / ${{ name: user.name }}`',
    ],
    [
      'a repeated variable that is written in between',
      "t`${{ name }} ${{ middle: (name = 'Grace') }} ${{ name }}`;",
      't({ $_hash: "#" })`${{ name }} ${{ middle: name = ',
    ],
  ])('only injects the hash for %s', async (_name, body, expected) => {
    const output = await compile(body);
    expect(output).toMatch(/\$_hash: "[0-9a-f]+"/);
    expect(output).toContain(
      expected.replace('#', output!.match(/\$_hash: "([^"]+)"/)![1])
    );
    expect(output).not.toContain('$_tree');
  });

  it.each([
    ['derive()', 't`Role ${derive(role)}`;'],
    ['a dynamic branch', 't`${plural({ count }, { other: label })}`;'],
    ['a value that may be an object', 't`Hi ${props.user}`;'],
  ])('leaves a template with %s to the runtime', async (_name, body) => {
    expect(await compile(body)).toBeNull();
  });

  it('keeps the tagged templates when precomputeMessages is false', async () => {
    const output = await transformWithPlugin(
      { precomputeMessages: false },
      module('t`Hello, ${{ name }}!`;')
    );
    expect(output).toContain(
      `t({ $_hash: "${hashOf(['Hello, ', ['name'], '!'])}" })\`Hello, \${{ name }}!\``
    );
  });

  it('lets a bundler drop the message of an unused call site', async () => {
    const compiled = await transformWithPlugin(
      PRECOMPUTE,
      `import { t } from 'gt-react';
export const used = (name) => t\`Kept \${{ name }}\`;
export const unused = (n) => [t\`Dropped\`, t({ context: 'x' })\`Dropped \${{ n }} too\`];`
    );
    const { outputFiles } = await build({
      stdin: {
        contents: "import { used } from 'compiled';\nconsole.log(used('Ada'));",
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      external: ['gt-react'],
      plugins: [
        {
          name: 'compiled',
          setup({ onResolve, onLoad }) {
            onResolve({ filter: /^compiled$/ }, () => ({
              path: 'compiled',
              namespace: 'compiled',
            }));
            onLoad({ filter: /.*/, namespace: 'compiled' }, () => ({
              contents: compiled!,
            }));
          },
        },
      ],
    });
    const [{ text }] = outputFiles;
    expect(text).toContain('$_tree: ["Kept ", ["name"]]');
    expect(text).not.toContain('Dropped');
    expect(text.match(/\$_hash/g)).toHaveLength(1);
  });
});

describe('the installed runtime', () => {
  /** An app whose node_modules hold `packages`, each a name and the gt-i18n it depends on. */
  const install = (packages: Record<string, 'new' | 'old' | undefined>) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-runtime-'));
    onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
    const writePackage = (dir: string, name: string, entry: string) => {
      fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name,
          // As published, react-core has subpath entries only
          exports:
            name === '@generaltranslation/react-core'
              ? { './pure': './dist/pure.cjs' }
              : {
                  '.': './dist/index.cjs',
                  './internal': './dist/internal.cjs',
                },
        })
      );
      fs.writeFileSync(path.join(dir, 'dist/index.cjs'), '');
      fs.writeFileSync(path.join(dir, 'dist/pure.cjs'), '');
      fs.writeFileSync(path.join(dir, 'dist/internal.cjs'), entry);
    };
    for (const [name, runtime] of Object.entries(packages)) {
      const dir = path.join(root, 'node_modules', name);
      writePackage(dir, name, '');
      if (!runtime) continue;
      writePackage(
        name === 'gt-i18n' ? dir : path.join(dir, 'node_modules/gt-i18n'),
        'gt-i18n',
        runtime === 'new'
          ? 'exports.createGT = 1; exports.isPrecomputedMessage = 1;'
          : 'exports.createGT = 1;'
      );
    }
    return root;
  };

  it.each([
    ['a runtime that reads them', { 'gt-react': 'new' }, true],
    ['an older runtime', { 'gt-react': 'old' }, false],
    [
      'an older runtime next to a newer one',
      { 'gt-next': 'new', 'gt-react': 'old' },
      false,
    ],
    [
      'an older runtime behind a package with no root entry',
      { 'gt-react': 'new', '@generaltranslation/react-core': 'old' },
      false,
    ],
    ['gt-i18n alone', { 'gt-i18n': 'new' }, true],
    ['an older gt-i18n alone', { 'gt-i18n': 'old' }, false],
    ['no GT runtime', { react: undefined }, undefined],
  ] as const)('finds %s', (_name, packages, expected) => {
    expect(findPrecomputedMessageSupport(install(packages))).toBe(expected);
  });

  const TEMPLATE = "import { t } from 'gt-react';\nt`Hello, ${{ name }}!`;";

  /** Compiles `source` as a file of `directory` with the plugin made in `cwd`. */
  const compileIn = async (
    cwd: string,
    directory: string,
    source = TEMPLATE,
    parsingFlags: Record<string, boolean> = {}
  ) => {
    const spy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => {
      spy.mockRestore();
      warn.mockRestore();
    });
    const { default: gtUnplugin } = await import('../index');
    const plugin = gtUnplugin.raw(
      {
        gtConfig: {
          defaultLocale: 'en',
          locales: ['fr'],
          files: { gt: { parsingFlags } },
        },
      },
      { framework: 'vite' }
    );
    const transform = plugin.transform as (
      this: unknown,
      code: string,
      id: string
    ) => Promise<{ code: string } | null>;
    fs.mkdirSync(directory, { recursive: true });
    const compileId = async (id: string) =>
      (
        await transform.call(
          { warn() {}, error() {}, addWatchFile() {} },
          source,
          id
        )
      )?.code;
    const compile = (file: string) => compileId(path.join(directory, file));
    return { compile, compileId, warn };
  };
  const TAGGED = `t({ $_hash: "${hashOf(['Hello, ', ['name'], '!'])}" })\`Hello, \${{ name }}!\``;

  it('keeps the tagged templates, with one warning, next to an older runtime', async () => {
    const root = install({ 'gt-react': 'old' });
    const { compile, warn } = await compileIn(root, path.join(root, 'src'));
    expect(await compile('App.tsx')).toContain(TAGGED);
    expect(await compile('Other.tsx')).toContain(TAGGED);
    expect(
      warn.mock.calls.filter(([message]) =>
        String(message).includes('does not read precomputed messages')
      )
    ).toHaveLength(1);
  });

  it('reads the runtime of the app a file is in, not of the working directory', async () => {
    // A build started from the directory above an app with an older runtime
    const app = install({ 'gt-react': 'old' });
    const { compile, warn } = await compileIn(
      path.dirname(app),
      path.join(app, 'src')
    );
    expect(await compile('App.tsx')).toContain(TAGGED);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('does not read precomputed messages')
    );
  });

  it('precomputes next to a runtime that reads the messages', async () => {
    const root = install({ 'gt-react': 'new' });
    const { compile, warn } = await compileIn(root, path.join(root, 'src'));
    expect(await compile('App.tsx')).toContain(
      '$_tree: ["Hello, ", ["name"], "!"]'
    );
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringMatching(/does not read precomputed|message trees are off/)
    );
  });

  it('keeps the tagged templates where it finds no runtime, and says so once, naming the first directory', async () => {
    const root = install({ react: undefined });
    const { compile, warn } = await compileIn(root, path.join(root, 'src'));
    expect(await compile('App.tsx')).toContain(TAGGED);
    expect(await compile('Other.tsx')).toContain(TAGGED);
    const said = warn.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.includes('message trees are off'));
    expect(said).toHaveLength(1);
    expect(said[0]).toContain(
      `Build-time message trees are off for the files in ${path.join(root, 'src')}`
    );
    expect(said[0]).toContain('no gt-i18n runtime was found');
    expect(said[0]).toContain('Set precomputeMessages: true');
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('does not read precomputed messages')
    );
  });

  it.each([
    [
      'useGT()',
      "import { useGT } from 'gt-react';\nexport function Label({ name }) {\n  const t = useGT();\n  return t`Hello, ${{ name }}!`;\n}",
    ],
    [
      'getGT()',
      "import { getGT } from 'gt-next/server';\nexport async function load(name) {\n  const t = await getGT();\n  return t`Hello, ${{ name }}!`;\n}",
    ],
  ])(
    'looks for the runtime of a file with a template of %s',
    async (_name, source) => {
      const root = install({ react: undefined });
      const { compile, warn } = await compileIn(
        root,
        path.join(root, 'src'),
        source
      );
      expect(await compile('App.tsx')).toContain(TAGGED);
      expect(
        warn.mock.calls.filter(([message]) =>
          String(message).includes('message trees are off')
        )
      ).toHaveLength(1);
    }
  );

  // Every file that imports a GT entry reaches the pass that precomputes
  it.each([
    [
      'a <T> its author wrote',
      compileJsx(
        "import { T } from 'gt-react';\nexport const App = () => <T>Hello</T>;"
      ),
      {},
      '_hash: "',
    ],
    [
      'a <T> the compiler added',
      compileJsx('export const App = () => <div>Hello</div>;'),
      { enableAutoJsxInjection: true },
      'GtInternalTranslateJsx',
    ],
    [
      'a msg template',
      "import { msg } from 'gt-react';\nexport const save = msg`Save`;",
      {},
      'msg({ $_hash: "',
    ],
  ])(
    'looks for no runtime for a file with only %s',
    async (_name, source, parsingFlags, compiled) => {
      const root = install({ react: undefined });
      const { compile, warn } = await compileIn(
        root,
        path.join(root, 'src'),
        source,
        parsingFlags
      );
      expect(await compile('App.tsx')).toContain(compiled);
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/does not read precomputed|message trees are off/)
      );
    }
  );

  it.each([
    ['a virtual module', '\0virtual:labels.ts'],
    ['a virtual module named after a file', '\0/abs/src/labels.ts'],
    ['a relative path', 'src/labels.ts'],
  ])(
    'keeps the tagged templates of %s, whose id has no directory to find a runtime from',
    async (_name, id) => {
      const root = install({ 'gt-react': 'new' });
      const { compileId } = await compileIn(root, path.join(root, 'src'));
      expect(await compileId(id)).toContain(TAGGED);
    }
  );

  it('says nothing of the runtime where the option is set', async () => {
    const root = install({ react: undefined });
    const spy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => {
      spy.mockRestore();
      warn.mockRestore();
    });
    const { default: gtUnplugin } = await import('../index');
    const transform = gtUnplugin.raw(
      {
        gtConfig: { defaultLocale: 'en', locales: ['fr'] },
        precomputeMessages: true,
      },
      { framework: 'vite' }
    ).transform as (
      this: unknown,
      code: string,
      id: string
    ) => Promise<{ code: string } | null>;
    const result = await transform.call(
      { warn() {}, error() {}, addWatchFile() {} },
      "import { t } from 'gt-react';\nt`Hello, ${{ name }}!`;",
      path.join(root, 'src', 'App.tsx')
    );
    expect(result?.code).toContain('$_tree: ["Hello, ", ["name"], "!"]');
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('message trees are off')
    );
  });
});

type Case = {
  name: string;
  /** Body of `App`, a function of `props` that returns the rendered text */
  body: string;
  /** Statements before `App` */
  setup?: string;
  translation?: unknown;
  renders?: Record<string, unknown>[];
  /** Whether the call site passes a precomputed message or stays a template */
  expected?: 'precomputed' | 'kept';
};

const DUE = new Date(Date.UTC(2024, 0, 15, 12));
const COUNTS = [0, 1, 2, 1.5, 1000000].map((count) => ({ count }));

const CASES: Case[] = [
  { name: 'text', body: 't`Save`', translation: 'Enregistrer' },
  { name: 'text without a translation', body: 't`Cancel`' },
  { name: 'empty text', body: 't``', translation: '' },
  {
    name: 'context and maxChars',
    body: "t({ context: 'button', maxChars: 8 })`Save all changes`",
    translation: 'Enregistrer toutes les modifications',
  },
  {
    name: 'negative maxChars on the source',
    body: 't({ maxChars: -8 })`Discard all changes`',
  },
  {
    name: 'named variables the translation reorders',
    body: 't`${{ name: props.name }} invited ${{ guest: props.guest }}`',
    translation: [['guest'], ' : invitation de ', ['name']],
    renders: [
      { name: 'Ada', guest: 'Grace' },
      { name: 12.5, guest: null },
      { name: 12n, guest: undefined },
      { name: true, guest: DUE },
    ],
  },
  {
    name: 'a variable repeated with the same value',
    setup: "const name = 'Ada';",
    body: 't`${{ name }} and ${{ name }}`',
  },
  {
    name: 'a repeated value that is not a variable',
    body: 't`${{ name: props.name }} and ${{ name: props.name }}`',
    renders: [{ name: 'Ada' }],
    expected: 'kept',
  },
  {
    name: 'a repeated variable that is written in between',
    setup: "let name = 'Ada';",
    body: "t`${{ name }} ${{ middle: (name = 'Grace') }} ${{ name }}`",
    expected: 'kept',
  },
  {
    name: 'values without a name',
    setup: "const total = 3;\nconst label = total > 2 ? 'many' : 'few';",
    body: 't`${total} of ${total + 1}: ${label} ${!total} ${undefined} ${`${total}`}`',
    translation: [
      ['_gt_3'],
      ' : ',
      ['_gt_1'],
      ' sur ',
      ['_gt_2'],
      ['_gt_4'],
      ['_gt_5'],
      ['_gt_6'],
    ],
  },
  {
    name: 'a plural',
    body: 't`You have ${plural({ count: props.count }, { "=0": "no items", one: part`${n} item`, other: part`${n} items` })}.`',
    translation: [
      'Vous avez ',
      [
        'count',
        'plural',
        {
          '=0': 'aucun article',
          one: [0, ' article'],
          many: [0, " d'articles"],
          other: [0, ' articles'],
        },
      ],
      '.',
    ],
    renders: COUNTS,
  },
  {
    name: 'a plural with a select and a variable in its branches',
    body: "t`${plural({ count: props.count }, { one: part`${n} file from ${{ name: props.name }}`, other: part`${n} files for ${select({ role: props.role }, { admin: 'admins', other: 'everyone' })}` })}`",
    translation: [
      [
        'count',
        'plural',
        {
          one: [0, ' fichier de ', ['name']],
          other: [
            0,
            ' fichiers pour ',
            ['role', 'select', { admin: 'les admins', other: 'tous' }],
          ],
        },
      ],
    ],
    renders: [
      { count: 1, name: 'Ada', role: 'admin' },
      { count: 5, name: 'Ada', role: 'admin' },
      { count: 5, name: 'Ada', role: 'guest' },
    ],
  },
  {
    name: 'helper values without a name',
    setup: "const count = 2;\nconst role = count > 1 ? 'admin' : 'member';",
    body: "t`${plural(count, { one: 'One file', other: part`${n} files` })} for ${select(role, { admin: 'admins', member: 'members' })}`",
    translation: [
      ['_gt_2', 'select', { admin: 'Admins', member: 'Membres', other: '' }],
      ' : ',
      ['_gt_1', 'plural', { one: 'un fichier', other: [0, ' fichiers'] }],
    ],
  },
  {
    name: 'an ordinal',
    body: 't`${ordinal({ place: props.count }, { one: part`${n}st`, two: part`${n}nd`, few: part`${n}rd`, other: part`${n}th` })} place`',
    translation: [
      ['place', 'selectordinal', { one: [0, 're'], other: [0, 'e'] }],
      ' place',
    ],
    renders: COUNTS.slice(1),
  },
  {
    name: 'a select',
    body: "t`${select({ role: props.role }, { admin: 'Admin', member: 'Member', other: 'Guest' })}`",
    translation: [
      [
        'role',
        'select',
        { admin: 'Administratrice', member: 'Membre', other: 'Invitée' },
      ],
    ],
    renders: [{ role: 'admin' }, { role: 'member' }, { role: 'x' }],
  },
  {
    name: 'a number with a literal formatting context',
    body: "t`Total: ${number({ price: props.price }, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} (${number({ share: props.share }, { style: 'percent' })})`",
    translation: [
      'Total : ',
      ['price', 'number', 'currency'],
      ' (',
      ['share', 'number', 'percent'],
      ')',
    ],
    renders: [{ price: 1234.56, share: 0.256 }],
  },
  {
    name: 'a number with a formatting context read at runtime',
    body: "t`For ${{ name: props.name }}: ${number({ price: props.price }, { style: 'currency', currency: props.currency, currencyDisplay: 'code' })}`",
    translation: [['price', 'number', 'currency'], ' : ', ['name']],
    renders: [
      { price: 1234.56, currency: 'USD', name: 'Ada' },
      { price: 0.5, currency: 'JPY', name: 'Grace' },
    ],
  },
  {
    name: 'a formatting context read before a value that is not a variable',
    body: "t`Total: ${number({ price: props.price }, { style: 'currency', currency: props.currency, currencyDisplay: 'code' })} for ${{ name: props.name }}`",
    translation: [['name'], ' : ', ['price', 'number', 'currency']],
    renders: [{ price: 1234.56, currency: 'USD', name: 'Ada' }],
    expected: 'kept',
  },
  {
    name: 'a getter that changes a formatting context read before it',
    setup:
      "let currency = 'USD';\nconst data = { get label() { currency = 'EUR'; return 'total'; } };",
    body: "t`${number({ price: 10 }, { style: 'currency', currency })} ${{ label: data.label }}`",
    expected: 'kept',
  },
  {
    name: 'a conversion that changes a formatting context read before it',
    setup:
      "let currency = 'USD';\nconst data = { toString() { currency = 'EUR'; return 'total'; } };",
    body: "t`${number({ price: 10 }, { style: 'currency', currency })} ${{ label: `${data}` }}`",
    expected: 'kept',
  },
  {
    name: 'a date and a time',
    body: "t`Due ${date({ due: props.due }, { style: 'medium', timeZone: 'UTC' })} at ${time({ at: props.due }, { hour: 'numeric', minute: '2-digit', timeZone: props.timeZone })}`",
    translation: [
      'Pour le ',
      ['due', 'date', 'medium'],
      ' à ',
      ['at', 'time', { hour: 'numeric', minute: '2-digit' }],
    ],
    renders: [
      { due: DUE, timeZone: 'UTC' },
      { due: DUE.getTime(), timeZone: 'Asia/Tokyo' },
    ],
  },
  {
    name: 'a translation that fails to format',
    body: 't`Hello, ${{ name: props.name }}!`',
    translation: ['Bonjour, ', ['nom']],
    renders: [{ name: 'Ada' }],
  },
  {
    name: 'a translation that is not a tree',
    body: 't`Malformed`',
    translation: { text: 'Mal formé' },
  },
  {
    name: 'a value of the wrong type',
    body: "t`${plural({ count: props.count }, { other: 'items' })}`",
    renders: [{ count: 'many' }, { count: 2 }],
  },
  {
    name: 'a name bound to two values',
    body: 't`${{ name: props.name }} / ${{ name: props.other }}`',
    renders: [
      { name: 'Ada', other: 'Ada' },
      { name: 'Ada', other: 'Grace' },
    ],
    expected: 'kept',
  },
  {
    name: 'a formatting context with a side effect, which keeps its place',
    setup: "const codes = ['USD', 'EUR', 'JPY', 'GBP'];",
    body: "t`${number({ price: props.price }, { style: 'currency', currency: codes.shift() })}`",
    renders: [{ price: 5 }],
  },
  {
    name: 'a msg template',
    body: 'm(msg`Later, ${{ name: props.name }}`)',
    translation: ['Plus tard, ', ['name']],
    renders: [{ name: 'Ada' }],
    expected: 'kept',
  },
];

const source = ({ setup = '', body }: Case) =>
  module(`${setup}\nexport const App = (props) => ${body};`);

describe.each(['en', 'fr'])('rendering in %s', (locale) => {
  let loading: Promise<GTRuntime> | undefined;

  /** gt-react in `locale`, with every case's translation loaded for fr. */
  const loadRuntime = () =>
    (loading ??= (async () => {
      Reflect.deleteProperty(globalThis, '__generaltranslation');
      const translations: Record<string, unknown> = {
        [hashOf('Save')]: 'Enregistrer',
      };
      for (const testCase of CASES) {
        if (testCase.translation === undefined) continue;
        const output = await transformWithPlugin(
          { precomputeMessages: false },
          source(testCase)
        );
        translations[output!.match(/\$_hash: "([^"]+)"/)![1]] =
          testCase.translation;
      }
      return loadGTRuntime(locale, async (requested) =>
        requested === 'fr' ? translations : {}
      );
    })());

  afterAll(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  const renderAll = async (
    code: string,
    renders: Record<string, unknown>[]
  ) => {
    const { App } = evaluateModule(code, (await loadRuntime()).modules);
    // A translation that cannot render is reported once, by either build.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Twice, so the second pass renders what each call site kept.
    const rendered = [...renders, ...renders].map((props) => {
      try {
        return String((App as (props: unknown) => unknown)(props));
      } catch (error) {
        return `threw: ${(error as Error).message}`;
      }
    });
    warn.mockRestore();
    return rendered;
  };

  it.each(CASES.map((testCase) => [testCase.name, testCase] as const))(
    'renders %s like its template',
    async (_name, testCase) => {
      const { renders = [{}], expected = 'precomputed' } = testCase;
      const code = source(testCase);
      const template = await transformWithPlugin(
        { precomputeMessages: false },
        code
      );
      const precomputed = await transformWithPlugin(PRECOMPUTE, code);
      if (expected === 'kept') {
        expect(precomputed).toBe(template);
      } else {
        expect(precomputed).toMatch(
          /export const App = \(props\) => t\(\{ \$_hash: "[0-9a-f]+", \$_tree: /
        );
      }
      const rendered = await renderAll(precomputed!, renders);
      expect(rendered).toEqual(await renderAll(template!, renders));
      // And like the source nothing compiled, which the runtime hashes.
      expect(rendered).toEqual(await renderAll(code, renders));
    }
  );

  it('renders useGT() templates like its templates', async () => {
    const code = compileJsx(`import { useGT, plural, part, n } from 'gt-react';
      export function App({ name, count }) {
        const gt = useGT();
        return <span title={gt\`Save\`}>{gt\`\${{ name }} has \${plural({ count }, { one: part\`\${n} item\`, other: part\`\${n} items\` })}\`}</span>;
      }`);
    const template = await transformWithPlugin(
      { precomputeMessages: false },
      code
    );
    const precomputed = await transformWithPlugin(PRECOMPUTE, code);
    expect(precomputed).toMatch(
      /gt\(\{ \$_hash: "[0-9a-f]+", \$_tree: \[.*\] \}, \{ name, count \}\)/
    );
    const props = { name: 'Ada', count: 2 };
    const runtime = await loadRuntime();
    const html = await runtime.render(
      evaluateModule(precomputed!, runtime.modules).App,
      props
    );
    expect(html).toBe(
      await runtime.render(
        evaluateModule(template!, runtime.modules).App,
        props
      )
    );
    expect(html).toBe(
      locale === 'fr'
        ? '<span title="Enregistrer">Ada has 2 items</span>'
        : '<span title="Save">Ada has 2 items</span>'
    );
  });
});
