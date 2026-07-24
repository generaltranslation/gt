import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../console/logger.js', () => ({
  logger: {
    message: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// A stand-in eslint whose --fix writes whatever the current test asks for, so
// the rollback path can be exercised without a real eslint config.
let eslintFixture: { file: string; content: string } | null = null;
/**
 * Per-file behavior for the same stand-in, for the tests that need eslint to
 * fail part way through the pass (round 9 F6): each entry may rewrite its file,
 * throw, or both, in the order the formatter visits them.
 */
let eslintPerFile = new Map<string, { content?: string; throws?: string }>();

vi.mock('eslint', () => ({
  ESLint: class {
    async lintFiles(files: string[]) {
      return files.map((filePath) => ({ filePath }));
    }
    static async outputFixes(results?: { filePath: string }[]) {
      for (const { filePath } of results ?? []) {
        const action = eslintPerFile.get(filePath);
        if (!action) continue;
        if (action.content !== undefined)
          fs.writeFileSync(filePath, action.content);
        if (action.throws) throw new Error(action.throws);
      }
      if (!eslintFixture) return;
      fs.writeFileSync(eslintFixture.file, eslintFixture.content);
    }
  },
}));

/**
 * What the stand-in `npx @biomejs/biome format --write` does: biome writes the
 * files itself, so a run that fails can still have rewritten some of them.
 */
let biomeRun: {
  writes?: { file: string; content: string }[];
  /** run after the writes, e.g. to make a file unwritable */
  after?: () => void;
  error?: string;
  exitCode?: number;
} | null = null;

vi.mock('node:child_process', () => ({
  spawn: () => {
    const handlers = new Map<string, (arg: never) => void>();
    setTimeout(() => {
      for (const write of biomeRun?.writes ?? []) {
        fs.writeFileSync(write.file, write.content);
      }
      biomeRun?.after?.();
      if (biomeRun?.error) {
        handlers.get('error')?.(new Error(biomeRun.error) as never);
        return;
      }
      handlers.get('close')?.((biomeRun?.exitCode ?? 0) as never);
    }, 0);
    return {
      on(event: string, callback: (arg: never) => void) {
        handlers.set(event, callback);
        return this;
      },
    };
  },
}));

import { logger } from '../../console/logger.js';
import {
  detectFormatter,
  formatFiles,
  jsxChildSignature,
} from '../postProcess.js';

// Round 9, class B: `gt migrate` changed visible CTA text (`Live demo→` ->
// `Live demo →`) because the CLI reformatted every file it wrote with a prettier
// resolved from its OWN dependency tree, at prettier's defaults, in a project
// that has no prettier config. The reflow materialised a `{" "}` next to a JSX
// text node holding an HTML entity, and that whitespace is rendered even though
// the original end-of-line space was dropped.
//
// Two guarantees are pinned here:
//   1. formatting only runs when the PROJECT itself resolves prettier and has a
//      prettier config (bounded to the project, never an ancestor);
//   2. when it does run, a reformat that changes the element-wise JSX child list
//      is discarded and the file is reported.

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

beforeEach(() => {
  eslintFixture = null;
  eslintPerFile = new Map();
  biomeRun = null;
  vi.mocked(logger.message).mockClear();
  vi.mocked(logger.warn).mockClear();
});

function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-postprocess-'));
  tmpDirs.push(dir);
  return dir;
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** A project directory: package.json, a repo marker, and the given files. */
function makeProject(root: string, files: Record<string, string> = {}): string {
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  write(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'demo', private: true })
  );
  for (const [rel, content] of Object.entries(files)) {
    write(path.join(root, rel), content);
  }
  return root;
}

/**
 * A stand-in prettier inside the project's own node_modules. The real prettier
 * is exercised too (below), but a stub makes the detection assertion independent
 * of any one prettier version's line-breaking decisions.
 */
function installStubPrettier(
  projectRoot: string,
  body: {
    transform: string;
    configFile: string | null;
    format?: 'esm' | 'cjs';
  }
): void {
  const dir = path.join(projectRoot, 'node_modules', 'prettier');
  const isCjs = body.format === 'cjs';
  const entry = isCjs ? 'index.cjs' : 'index.mjs';
  write(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'prettier', version: '3.0.0', main: entry })
  );
  const configLiteral =
    body.configFile === null ? 'null' : JSON.stringify(body.configFile);
  const source = [
    `const CONFIG_FILE = ${configLiteral};`,
    'function resolveConfigFile() { return Promise.resolve(CONFIG_FILE); }',
    'function resolveConfig() { return Promise.resolve(CONFIG_FILE ? {} : null); }',
    'function format(source) {',
    `  return Promise.resolve(${body.transform});`,
    '}',
    isCjs
      ? 'module.exports = { format, resolveConfig, resolveConfigFile };'
      : 'export { format, resolveConfig, resolveConfigFile };',
  ].join('\n');
  write(path.join(dir, entry), source);
}

/** The real prettier this repo installs, linked into a project's node_modules. */
function linkRealPrettier(projectRoot: string): void {
  const require = createRequire(import.meta.url);
  let dir = path.dirname(require.resolve('prettier'));
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir)
      throw new Error('could not locate the prettier package');
    dir = parent;
  }
  const target = path.join(projectRoot, 'node_modules');
  fs.mkdirSync(target, { recursive: true });
  fs.symlinkSync(dir, path.join(target, 'prettier'), 'dir');
}

// The exact shape from the round-9 report: a JSX child that is
// `{expression}` + space + text holding an HTML entity, on a line that exceeds
// prettier's default printWidth (83 columns), next to an identical site that is
// short enough (70 columns) to be left alone.
const CTA_SOURCE = [
  'type Props = { secondaryLinkLabel?: string; secondaryLink: string };',
  'declare const intl: (id: string) => string;',
  '',
  'export function ProjectCard({ secondaryLinkLabel, secondaryLink }: Props) {',
  '  return (',
  '    <div className="card">',
  '      <a className="cta" href={secondaryLink}>',
  '        {secondaryLinkLabel || intl("ProjectCard.demoDefaultLongEnoughKey")} &rarr;',
  '      </a>',
  '      <a className="cta" href={secondaryLink}>',
  '        {secondaryLinkLabel || intl("ProjectCard.viewDefault")} &rarr;',
  '      </a>',
  '    </div>',
  '  );',
  '}',
  '',
].join('\n');

// What prettier 3 does to the long site: the trailing space becomes a rendered
// `{" "}` child of its own.
const CTA_REFLOWED = CTA_SOURCE.replace(
  '        {secondaryLinkLabel || intl("ProjectCard.demoDefaultLongEnoughKey")} &rarr;',
  [
    '        {secondaryLinkLabel || intl("ProjectCard.demoDefaultLongEnoughKey")}{" "}',
    '        &rarr;',
  ].join('\n')
);

describe('formatFiles only formats when the project formats', () => {
  it('leaves the generated output alone when the project has no formatter', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    const file = path.join(root, 'src/card.tsx');

    const report = await formatFiles([file]);

    expect(fs.readFileSync(file, 'utf-8')).toBe(CTA_SOURCE);
    expect(report.formatter).toBeNull();
    expect(report.formattedFiles).toEqual([]);
    expect(report.reason).toMatch(/no formatter/);
    // The path taken is logged, not silent.
    expect(vi.mocked(logger.message).mock.calls.join(' ')).toMatch(
      /Skipping formatting/
    );
  });

  it('leaves the generated output alone when the project has prettier but no config', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    installStubPrettier(root, {
      transform: "source.replace('&rarr;', 'BROKEN')",
      configFile: null,
    });
    const file = path.join(root, 'src/card.tsx');

    const report = await formatFiles([file]);

    expect(fs.readFileSync(file, 'utf-8')).toBe(CTA_SOURCE);
    expect(report.formattedFiles).toEqual([]);
    expect(report.reason).toMatch(/prettier config/);
    expect(vi.mocked(logger.message).mock.calls.join(' ')).toMatch(
      /Skipping formatting/
    );
  });

  it('ignores a prettier that lives above the project boundary', async () => {
    // A prettier install and config in an ancestor directory (the gt monorepo
    // when the CLI is run from a checkout, or an unrelated parent) is not this
    // project's choice of formatter.
    const outer = tmpRoot();
    installStubPrettier(outer, {
      transform: "source.replace('&rarr;', 'BROKEN')",
      configFile: path.join(outer, '.prettierrc'),
    });
    write(path.join(outer, '.prettierrc'), '{}');
    write(path.join(outer, 'package.json'), JSON.stringify({ name: 'outer' }));
    const root = makeProject(path.join(outer, 'project'), {
      'src/card.tsx': CTA_SOURCE,
    });
    const file = path.join(root, 'src/card.tsx');

    const report = await formatFiles([file]);

    expect(fs.readFileSync(file, 'utf-8')).toBe(CTA_SOURCE);
    expect(report.formattedFiles).toEqual([]);
    expect(await detectFormatter(root)).toBeNull();
  });

  it('formats with the project prettier when the change is JSX-neutral', async () => {
    const source = [
      "const greeting = 'hi';",
      'export function Hello() {',
      '  return <p>{greeting}</p>;',
      '}',
      '',
    ].join('\n');
    const root = makeProject(tmpRoot(), { 'src/hello.tsx': source });
    write(path.join(root, '.prettierrc'), '{}');
    installStubPrettier(root, {
      transform: `source.replace("'hi'", '"hi"')`,
      configFile: path.join(root, '.prettierrc'),
    });
    const file = path.join(root, 'src/hello.tsx');

    const report = await formatFiles([file]);

    expect(fs.readFileSync(file, 'utf-8')).toContain('"hi"');
    expect(report.formattedFiles).toEqual([file]);
    expect(report.preservedFiles).toEqual([]);
    expect(vi.mocked(logger.message).mock.calls.join(' ')).toMatch(
      /Cleaning up with prettier/
    );
  });

  it('discards a reformat that materialises a rendered space next to an entity', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    write(path.join(root, '.prettierrc'), '{}');
    installStubPrettier(root, {
      transform: JSON.stringify(CTA_REFLOWED),
      configFile: path.join(root, '.prettierrc'),
    });
    const file = path.join(root, 'src/card.tsx');

    const report = await formatFiles([file]);

    // The generator's own output ships, and the file is named.
    expect(fs.readFileSync(file, 'utf-8')).toBe(CTA_SOURCE);
    expect(report.preservedFiles).toEqual([file]);
    expect(report.formattedFiles).toEqual([]);
    expect(vi.mocked(logger.warn).mock.calls.join(' ')).toContain(file);
  });

  it('keeps the JSX children identical when the real prettier runs', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    write(path.join(root, '.prettierrc'), '{}');
    linkRealPrettier(root);
    const file = path.join(root, 'src/card.tsx');

    const report = await formatFiles([file]);
    const emitted = fs.readFileSync(file, 'utf-8');

    expect(report.formatter).toBe('prettier');
    // The invariant: whatever this prettier version decided, the element-wise
    // child list of every JSX element is unchanged.
    expect(jsxChildSignature(emitted, file)).toBe(
      jsxChildSignature(CTA_SOURCE, file)
    );
    // Either the format was safe, or the file was kept unformatted; never both.
    if (emitted === CTA_SOURCE) {
      expect(report.preservedFiles).toEqual([file]);
    } else {
      expect(report.preservedFiles).toEqual([]);
    }
    // Prettier 3.6 reflows the 83-column site, so today it is the second case.
    expect(emitted).not.toContain('{" "}');
  });

  it('reads a CommonJS prettier build too', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    write(path.join(root, '.prettierrc'), '{}');
    installStubPrettier(root, {
      transform: JSON.stringify(CTA_REFLOWED),
      configFile: path.join(root, '.prettierrc'),
      format: 'cjs',
    });
    const file = path.join(root, 'src/card.tsx');

    const report = await formatFiles([file]);

    expect(report.formatter).toBe('prettier');
    expect(report.preservedFiles).toEqual([file]);
  });
});

describe('the invariant covers every formatter, not just prettier', () => {
  it('rolls back an eslint --fix that changed the JSX children', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    // Detection is by project presence; the eslint module itself is mocked below.
    write(
      path.join(root, 'node_modules', 'eslint', 'package.json'),
      JSON.stringify({ name: 'eslint', version: '9.0.0' })
    );
    const file = path.join(root, 'src/card.tsx');
    eslintFixture = { file, content: CTA_REFLOWED };

    const report = await formatFiles([file]);

    expect(report.formatter).toBe('eslint');
    expect(fs.readFileSync(file, 'utf-8')).toBe(CTA_SOURCE);
    expect(report.preservedFiles).toEqual([file]);
    expect(report.formattedFiles).toEqual([]);
  });

  it('keeps a safe eslint --fix', async () => {
    const source = [
      'export function Hello() {',
      '  return <p>hi</p>;',
      '}',
      '',
    ].join('\n');
    const root = makeProject(tmpRoot(), { 'src/hello.tsx': source });
    write(
      path.join(root, 'node_modules', 'eslint', 'package.json'),
      JSON.stringify({ name: 'eslint', version: '9.0.0' })
    );
    const file = path.join(root, 'src/hello.tsx');
    const fixed = source.replace('export function', 'export  function');
    eslintFixture = { file, content: fixed };

    const report = await formatFiles([file]);

    expect(fs.readFileSync(file, 'utf-8')).toBe(fixed);
    expect(report.formattedFiles).toEqual([file]);
    expect(report.preservedFiles).toEqual([]);
  });
});

// Round 9 F6 (R3): the rollback ran AFTER the per-file loop, so any throw
// inside the loop unwound past it and left files eslint had already rewritten
// on disk, unverified, with an empty preservedFiles and a report still saying
// "formatted with eslint --fix". Every snapshotted file must end in one of
// three reported states: kept, rolled back, or named as unverified.
describe('a formatter that fails part way still verifies what it wrote', () => {
  /** A project with eslint installed, so detection picks the eslint branch. */
  function eslintProject(files: Record<string, string>): string {
    const root = makeProject(tmpRoot(), files);
    write(
      path.join(root, 'node_modules', 'eslint', 'package.json'),
      JSON.stringify({ name: 'eslint', version: '9.0.0' })
    );
    return root;
  }

  const SAFE_SOURCE = [
    'export function Hello() {',
    '  return <p>hi</p>;',
    '}',
    '',
  ].join('\n');

  it('rolls back, keeps and reports across an eslint throw mid-pass', async () => {
    const root = eslintProject({
      'src/safe.tsx': SAFE_SOURCE,
      'src/card.tsx': CTA_SOURCE,
      'src/later.tsx': SAFE_SOURCE,
    });
    const safe = path.join(root, 'src/safe.tsx');
    const card = path.join(root, 'src/card.tsx');
    const later = path.join(root, 'src/later.tsx');
    const safeFixed = SAFE_SOURCE.replace(
      'export function',
      'export  function'
    );
    // File 1 gets a harmless rewrite, file 2 gets the rendered-whitespace
    // reflow the invariant exists to reject and then blows up (a parser or
    // plugin failure in a later overrides cascade, EACCES during the write).
    eslintPerFile.set(safe, { content: safeFixed });
    eslintPerFile.set(card, {
      content: CTA_REFLOWED,
      throws: 'fake eslint blew up on file 2',
    });

    const report = await formatFiles([safe, card, later]);

    // The unsafe rewrite is undone and named...
    expect(fs.readFileSync(card, 'utf-8')).toBe(CTA_SOURCE);
    expect(report.preservedFiles).toEqual([card]);
    // ...the safe one is kept and named...
    expect(fs.readFileSync(safe, 'utf-8')).toBe(safeFixed);
    expect(report.formattedFiles).toEqual([safe]);
    // ...the file the pass never reached is untouched...
    expect(fs.readFileSync(later, 'utf-8')).toBe(SAFE_SOURCE);
    expect(report.formattedFiles).not.toContain(later);
    // ...and the failure itself is on the report, not just in the console.
    expect(report.failure).toMatch(/eslint did not finish/);
    expect(report.failure).toContain('fake eslint blew up on file 2');
    expect(report.unverifiedFiles).toEqual([]);
  });

  it('names a file it could not snapshot instead of dropping it silently', async () => {
    const root = eslintProject({ 'src/hello.tsx': SAFE_SOURCE });
    const present = path.join(root, 'src/hello.tsx');
    // A file gt migrate wrote that the formatter pass can no longer read
    // (removed or unreadable in between): it cannot be verified or rolled
    // back, so it must be reported as such rather than skipped.
    const gone = path.join(root, 'src/gone.tsx');

    const report = await formatFiles([present, gone]);

    expect(report.unverifiedFiles).toEqual([gone]);
    expect(report.preservedFiles).toEqual([]);
  });

  it('reports a biome run that rewrote a file and then failed', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    write(
      path.join(root, 'node_modules', '@biomejs', 'biome', 'package.json'),
      JSON.stringify({ name: '@biomejs/biome', version: '1.9.0' })
    );
    const card = path.join(root, 'src/card.tsx');
    biomeRun = {
      writes: [{ file: card, content: CTA_REFLOWED }],
      exitCode: 1,
    };

    const report = await formatFiles([card]);

    expect(report.formatter).toBe('biome');
    expect(fs.readFileSync(card, 'utf-8')).toBe(CTA_SOURCE);
    expect(report.preservedFiles).toEqual([card]);
    expect(report.failure).toMatch(/biome did not finish: exit code 1/);
  });

  it('names an unsafe rewrite it could not roll back', async () => {
    const root = makeProject(tmpRoot(), { 'src/card.tsx': CTA_SOURCE });
    write(
      path.join(root, 'node_modules', '@biomejs', 'biome', 'package.json'),
      JSON.stringify({ name: '@biomejs/biome', version: '1.9.0' })
    );
    const card = path.join(root, 'src/card.tsx');
    biomeRun = {
      writes: [{ file: card, content: CTA_REFLOWED }],
      // Read-only after the rewrite: the restore write fails, which is the
      // worst state of all and so the one that must not be silent.
      after: () => fs.chmodSync(card, 0o444),
    };

    const report = await formatFiles([card]);

    expect(report.unverifiedFiles).toEqual([card]);
    expect(report.preservedFiles).toEqual([]);
    expect(report.formattedFiles).toEqual([]);
    fs.chmodSync(card, 0o644);
  });
});

describe('jsxChildSignature', () => {
  it('separates a space inside an entity text node from a {" "} child', () => {
    // The whole point of comparing element-wise: the CONCATENATION of these two
    // child lists is identical, and @babel/types' own buildChildren cleaning
    // reports them as equal too, which is the false negative the round-9
    // analysis hit before switching to real builds.
    expect(jsxChildSignature(CTA_SOURCE, 'card.tsx')).not.toBe(
      jsxChildSignature(CTA_REFLOWED, 'card.tsx')
    );
  });

  it('accepts pure re-indentation of an entity-bearing element', async () => {
    // The measured-safe case: quotes around an expression, expanded onto three
    // lines. Every implementation strips the indentation whitespace, so the
    // rendered text is unchanged and formatting must not be discarded.
    const inline = [
      'export function Quote({ text }: { text: string }) {',
      '  return <p className="quote">&ldquo;{text}&rdquo;</p>;',
      '}',
      '',
    ].join('\n');
    const expanded = [
      'export function Quote({ text }: { text: string }) {',
      '  return (',
      '    <p className="quote">',
      '      &ldquo;{text}&rdquo;',
      '    </p>',
      '  );',
      '}',
      '',
    ].join('\n');
    expect(jsxChildSignature(inline, 'quote.tsx')).toBe(
      jsxChildSignature(expanded, 'quote.tsx')
    );
  });

  it('tolerates a {" "} reshuffle in entity-free text', () => {
    // Measured on next-intl/sniply: prettier moves a separator's space into a
    // `{" "}` when it breaks the line. With no entity in the text node the
    // compiler keeps the inline space, so both shapes render the same and the
    // formatting must be allowed through (2 files in sniply hinged on this).
    const inline = 'export const A = () => <p>{a}{b} · {c}</p>;';
    const split = [
      'export const A = () => (',
      '  <p>',
      '    {a}',
      '    {b} ·{" "}',
      '    {c}',
      '  </p>',
      ');',
    ].join('\n');
    expect(jsxChildSignature(inline, 'a.tsx')).toBe(
      jsxChildSignature(split, 'a.tsx')
    );
  });

  it('keeps a non-breaking space as content, not layout whitespace', () => {
    const before = 'export const A = () => <span>{x}&nbsp;&rarr;</span>;';
    const after = 'export const A = () => <span>{x} &rarr;</span>;';
    expect(jsxChildSignature(before, 'a.tsx')).not.toBe(
      jsxChildSignature(after, 'a.tsx')
    );
  });
});
