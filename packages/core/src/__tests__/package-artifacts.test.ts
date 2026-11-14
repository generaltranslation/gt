import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const adapterMarker =
  'Each branch, file, and version may appear once in a publish list';
const projectPath = '/v2/projects/{projectId}/files/query';
const config = `{ apiKey: 'key', baseUrl: 'https://example.test', projectId: 'project' }`;
const allowedPackages = [
  'generaltranslation',
  '@generaltranslation/api',
  '@generaltranslation/format',
  '@generaltranslation/icu',
  '@noble/hashes',
];

// Parse imports rather than grep one entry: cover re-exports, require and dynamic
// imports too. A computed dependency is not an auditable isolated artifact.
function imports(code: string): string[] {
  const result: string[] = [];
  const visit = (node: ts.Node) => {
    let specifier: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      specifier = node.arguments[0];
      expect(specifier, 'computed dependency').toBeDefined();
    }
    if (specifier) {
      expect(ts.isStringLiteralLike(specifier), 'computed dependency').toBe(
        true
      );
      result.push((specifier as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile('artifact.js', code, ts.ScriptTarget.Latest, true));
  return result;
}

// Lays out what `pnpm pack` publishes (the manifest plus its `files`) as a real
// copy under the fixture, so bare imports resolve from the fixture's explicit
// dependency links and never from the workspace. Spawning pnpm for each of the
// four packages made this the slowest test in the package on CI. The copy is
// only faithful while nothing rewrites the manifest or file list at pack time
// and `files` names plain paths, so anything else fails here instead of being
// copied wrongly.
function layOutPublishedPackage(directory: string, fixture: string): void {
  const root = join(packageRoot, '..', directory);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  expect(manifest.publishConfig, 'pack-time manifest rewrite').toBeUndefined();
  expect(
    Object.keys(manifest.scripts).filter((name) =>
      ['prepack', 'postpack', 'prepare', 'prepublishOnly'].includes(name)
    ),
    'pack-time lifecycle scripts'
  ).toEqual([]);

  // A glob or a `!` negation selects files this copy cannot reproduce.
  expect(
    manifest.files.filter(
      (entry: string) =>
        /[*?[\]{}!]/.test(entry) || !existsSync(join(root, entry))
    ),
    '`files` entries that are not existing plain paths'
  ).toEqual([]);

  const published = join(fixture, directory);
  for (const entry of ['package.json', ...manifest.files]) {
    cpSync(join(root, entry), join(published, entry), { recursive: true });
  }
  // `files` overrides the package's own ignore file, but an ignore file inside
  // a published directory still drops files from the tarball.
  expect(
    readdirSync(published, { recursive: true }).filter((file) =>
      ['.npmignore', '.gitignore'].includes(basename(String(file)))
    ),
    'ignore files inside published directories'
  ).toEqual([]);
  const link = join(fixture, 'node_modules', manifest.name);
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(published, link, 'junction');
}

it('loads published ESM/CJS, typechecks NodeNext declarations and keeps the published runtime free of management', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'gt-core-artifacts-'));
  const nodeModules = join(fixture, 'node_modules');
  try {
    for (const directory of ['core', 'api', 'format', 'icu']) {
      layOutPublishedPackage(directory, fixture);
    }
    mkdirSync(join(nodeModules, '@noble'));
    symlinkSync(
      realpathSync(join(packageRoot, 'node_modules/@noble/hashes')),
      join(nodeModules, '@noble/hashes'),
      'junction'
    );
    // Declarations reference valibot for GTConfig; the runtime graph must not.
    symlinkSync(
      realpathSync(join(packageRoot, 'node_modules/valibot')),
      join(nodeModules, 'valibot'),
      'junction'
    );

    // Traverse the actual published runtime dependency graph in BOTH formats.
    // Relative chunks must exist; bare imports may only be declared lean deps.
    // Per-import byte gates live in .size-limit.cjs.
    for (const extension of ['mjs', 'cjs']) {
      const seen = new Set<string>();
      const visit = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        const code = readFileSync(file, 'utf8');
        expect(code).not.toContain(adapterMarker);
        expect(code).not.toContain(projectPath);
        for (const specifier of imports(code)) {
          if (specifier.startsWith('.')) {
            visit(resolve(dirname(file), specifier));
          } else {
            expect(
              allowedPackages.some(
                (name) => specifier === name || specifier.startsWith(`${name}/`)
              ),
              specifier
            ).toBe(true);
          }
        }
      };
      visit(
        join(nodeModules, 'generaltranslation/dist', `runtime.${extension}`)
      );
    }

    // One fresh Node consumer loads every entry through both export conditions.
    const smoke = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const assert = require('node:assert/strict');
      const config = ${config};
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        const body = await request.json();
        assert.equal(new URL(request.url).pathname, '/v2/projects/project/translate');
        assert.equal(request.headers.has('gt-project-id'), false);
        assert.equal(request.headers.get('authorization'), 'Bearer key');
        return Response.json({ results: body.requests.map(() => (
          { status: 'succeeded', translation: 'Hola', locale: 'es', dataFormat: 'STRING' })) });
      };
      const entries = ['generaltranslation', 'generaltranslation/runtime', 'generaltranslation/internal'];
      for (const entry of entries) {
        assert.match(import.meta.resolve(entry), /\\.mjs$/);
        assert.match(require.resolve(entry), /\\.cjs$/);
      }
      for (const load of [(entry) => import(entry), async (entry) => require(entry)]) {
        const [{ GeneralTranslation }, runtime] = await Promise.all(entries.map(load));
        for (const result of [
          (await new runtime.GTRuntime(config).translateMany(['Hello'], 'es'))[0],
          await new GeneralTranslation(config).translate('Hello', 'es'),
        ]) assert.equal(result.translation, 'Hola');
      }
    `;
    execFileSync(process.execPath, ['--input-type=module', '--eval', smoke], {
      cwd: fixture,
      stdio: 'pipe',
    });

    const types = `
      import { GeneralTranslation, GTIntl, type LocaleConfig, type OrgHandle, type ProjectHandle, type TranslateManyResult, type TranslateOptions, type TranslationResult } from 'generaltranslation';
      import { GTRuntime } from 'generaltranslation/runtime';
      const options = { targetLocale: 'es' } satisfies TranslateOptions;
      const localeConfig: LocaleConfig = { defaultLocale: 'en', locales: ['en', 'es'] };
      const account: GeneralTranslation = new GeneralTranslation({ apiKey: 'key' });
      const project: ProjectHandle = new GeneralTranslation({ apiKey: 'key', projectId: 'project', localeConfig });
      const org: OrgHandle = account.org('org');
      const runtimeProject = new GTRuntime({ apiKey: 'key', projectId: 'project', localeConfig });
      const asRuntimeProject: GTRuntime = account.project('project');
      const formatted: string = new GTIntl(localeConfig, { locale: 'es' }).formatNum(1, { locale: 'fr' });
      const array: Promise<TranslateManyResult> = runtimeProject.translateMany(['Hello'], options);
      const record: Promise<Record<string, TranslationResult>> = project.translateMany({ hello: 'Hello' }, 'es', 0);
      project.translate('Hello', 'es', 0);
      // @ts-expect-error the handle timeout is a number, not an options object.
      project.translate('Hello', 'es', { timeout: 10 });
      void [array, record, org, asRuntimeProject, formatted];
    `;
    const consumers = ['mts', 'cts'].map((extension) =>
      join(fixture, `consumer.${extension}`)
    );
    for (const consumer of consumers) writeFileSync(consumer, types);
    // The same check as `tsc --noEmit --strict` on both consumers, in process.
    // Published declarations are still checked; only TypeScript's own lib
    // files are skipped.
    const program = ts.createProgram(consumers, {
      noEmit: true,
      strict: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [],
      skipDefaultLibCheck: true,
    });
    expect(
      ts.formatDiagnostics(ts.getPreEmitDiagnostics(program), {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => fixture,
        getNewLine: () => '\n',
      })
    ).toBe('');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 120_000);
