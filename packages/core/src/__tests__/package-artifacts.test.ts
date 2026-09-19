import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import { build } from 'tsdown';
import ts from 'typescript';
import { expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const adapterMarker = 'call configureApiClient first';
const classMarker = 'resolveServiceResponseLocale';
const translationPath = '/v2/translate';
const tagPath = '/v2/project/tags/create';
const projectPath = '/v2/project/info/{projectId}';
const config = `{ projectId: 'project', apiKey: 'key', baseUrl: 'https://example.test' }`;
// Byte ceilings approved from the packed baseline; whole-entry size-limit
// budgets remain independent and unchanged. See README.md for measurements.
const limits = {
  runtime: [70_000, 22_000],
  named: [33_000, 12_000],
  constants: [100, 100],
  rawTranslate: [13_000, 4_500],
  rawTag: [13_000, 4_500],
  facade: [45_000, 15_000],
} as const;
const sources = {
  runtime: `import { GTRuntime } from 'generaltranslation/runtime';
    export const run = () => new GTRuntime(${config}).translateMany(['Hello'], 'es');`,
  named: `import { translateMany } from 'generaltranslation/runtime';
    export const run = () => translateMany(['Hello'], 'es', ${config});`,
  constants: `import { libraryDefaultLocale } from 'generaltranslation/internal';
    export const run = () => libraryDefaultLocale;`,
  rawTranslate: `import { createApiClient, translate } from 'generaltranslation/api';
    export const run = () => translate({ client: createApiClient(${config}),
      body: { requests: { hello: { source: 'Hello' } }, sourceLocale: 'en', targetLocale: 'es', metadata: {} } });`,
  rawTag: `import { createApiClient, createTag } from 'generaltranslation/api';
    export const run = () => createTag({ client: createApiClient(${config}), body: { tagId: 'tag', files: [] } });`,
  facade: `import { createGtApiAdapter } from 'generaltranslation/internal';
    export const run = () => createGtApiAdapter(${config}).getProjectInfo();`,
};

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

function assertIsolation(code: string, endpoints: string[], classes = false) {
  expect(code).not.toContain(adapterMarker);
  expect(code).not.toMatch(
    /(?:credentials?\.json|keytar|openBrowser|openid profile offline_access|Run `gt login`|\/cli\/wizard|node:)/
  );
  const paths = [...new Set(code.match(/\/v[12]\/[^"'`\s]+/g) ?? [])].sort();
  expect(paths).toEqual([...endpoints].sort());
  if (!classes) {
    expect(code).not.toContain(classMarker);
    expect(code).not.toContain('customRegionMapping');
    expect(code).not.toMatch(/GT_(?:API_KEY|DEV_API_KEY|PROJECT_ID)/);
  }
}

it('loads packed ESM/CJS and NodeNext declarations and isolates live bundled consumers', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'gt-core-artifacts-'));
  const nodeModules = join(fixture, 'node_modules');
  mkdirSync(nodeModules);
  const allowedPackages = [
    'generaltranslation',
    '@generaltranslation/api',
    '@generaltranslation/format',
    '@generaltranslation/icu',
    '@noble/hashes',
  ];
  try {
    // Like Vue's package-layout test, use pnpm's executable (not node + a
    // potentially native pnpm binary), packed files and explicit dependency links.
    for (const directory of ['core', 'api', 'format', 'icu']) {
      const root = join(packageRoot, '..', directory);
      const manifest = JSON.parse(
        readFileSync(join(root, 'package.json'), 'utf8')
      );
      const pack = join(fixture, directory);
      mkdirSync(pack);
      execFileSync(
        process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        ['pack', '--pack-destination', pack],
        { cwd: root, stdio: 'pipe' }
      );
      const archive = readdirSync(pack).find((name) => name.endsWith('.tgz'))!;
      execFileSync('tar', ['-xzf', join(pack, archive), '-C', pack]);
      const link = join(nodeModules, manifest.name);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(join(pack, 'package'), link, 'junction');
    }
    mkdirSync(join(nodeModules, '@noble'));
    symlinkSync(
      realpathSync(join(packageRoot, 'node_modules/@noble/hashes')),
      join(nodeModules, '@noble/hashes'),
      'junction'
    );

    // Traverse the actual published runtime dependency graph in BOTH formats.
    // Relative chunks must exist; bare imports may only be declared lean deps.
    for (const extension of ['mjs', 'cjs']) {
      const seen = new Set<string>();
      const dependencies: Record<string, string[]> = {};
      const visit = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        const code = readFileSync(file, 'utf8');
        expect(code).not.toContain(adapterMarker);
        expect(code).not.toContain(projectPath);
        const specifiers = imports(code);
        dependencies[file.replace(fixture, '<fixture>')] = specifiers;
        for (const specifier of specifiers) {
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
      process.stdout.write(
        `Published runtime ${extension}: ${JSON.stringify(dependencies)}\n`
      );
    }

    const smoke = `
      const assert = require('node:assert/strict');
      const config = ${config};
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        const body = await request.json();
        assert.equal(new URL(request.url).pathname, '/v2/translate');
        assert.equal(request.headers.get('gt-project-id'), 'project');
        assert.equal(request.headers.get('authorization'), 'Bearer key');
        return Response.json(Object.fromEntries(Object.keys(body.requests).map(key => [key,
          { success: true, translation: 'Hola', locale: 'es', dataFormat: 'STRING' }])));
      };
      const runtime = LOAD('generaltranslation/runtime');
      const { GT } = LOAD('generaltranslation');
      const { createGtApiAdapter } = LOAD('generaltranslation/internal');
      for (const result of [
        await runtime.translate('Hello', 'es', config),
        (await runtime.translateMany(['Hello'], 'es', config))[0],
        (await new runtime.GTRuntime(config).translateMany(['Hello'], 'es'))[0],
        await new GT(config).translate('Hello', 'es'),
        await createGtApiAdapter(config).translate('Hello', 'es'),
      ]) assert.equal(result.translation, 'Hola');
    `;
    for (const esm of [true, false]) {
      const script = esm
        ? `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); ${smoke.replaceAll('LOAD(', 'await import(')}`
        : `(async () => { ${smoke.replaceAll('LOAD(', 'require(')} })().catch(error => { console.error(error); process.exit(1); });`;
      execFileSync(
        process.execPath,
        [...(esm ? ['--input-type=module'] : []), '--eval', script],
        { cwd: fixture, stdio: 'pipe' }
      );
    }

    const types = `
      import { GT } from 'generaltranslation';
      import { GTRuntime, translate, translateMany, type TranslateConfig } from 'generaltranslation/runtime';
      import { createGtApiAdapter } from 'generaltranslation/internal';
      import type { TranslateManyResult, TranslationResult } from 'generaltranslation/types';
      import { API_VERSION } from 'generaltranslation/api';
      const config = { projectId: 'project', apiKey: 'key', baseUrl: 'https://example.test', timeoutMs: false, fetch, apiVersion: API_VERSION } satisfies TranslateConfig;
      const array: Promise<TranslateManyResult> = translateMany(['Hello'], 'es', config);
      const record: Promise<Record<string, TranslationResult>> = translateMany({ hello: 'Hello' }, 'es', config);
      const adapter = createGtApiAdapter(config);
      const bound: Promise<Record<string, TranslationResult>> = adapter.translateMany({ hello: 'Hello' }, 'es', false);
      translate('Hello', 'es', config);
      new GT().translate('Hello', 'es', 0);
      new GTRuntime().translateMany(['Hello'], 'es', 0);
      // @ts-expect-error timeoutMs is the only new timeout configuration spelling.
      translate('Hello', 'es', { timeout: 10 });
      void [array, record, bound];
    `;
    for (const extension of ['mts', 'cts']) {
      writeFileSync(join(fixture, `consumer.${extension}`), types);
    }
    for (const [name, source] of Object.entries(sources)) {
      writeFileSync(join(fixture, `${name}.mjs`), source);
    }
    execFileSync(
      process.execPath,
      [
        join(packageRoot, 'node_modules/typescript/bin/tsc'),
        '--allowJs',
        '--checkJs',
        '--noEmit',
        '--strict',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--target',
        'ES2022',
        '--lib',
        'ES2023,DOM,DOM.Iterable',
        join(fixture, 'consumer.mts'),
        join(fixture, 'consumer.cts'),
        ...Object.keys(sources).map((name) => join(fixture, `${name}.mjs`)),
      ],
      { cwd: fixture, stdio: 'inherit' }
    );

    async function bundle(name: string, entries = [name]) {
      const outDir = join(fixture, `output-${name}`);
      const bundles = await build({
        config: false,
        cwd: fixture,
        entry: Object.fromEntries(
          entries.map((entry) => [entry, join(fixture, `${entry}.mjs`)])
        ),
        outDir,
        format: 'esm',
        platform: 'neutral',
        minify: true,
        sourcemap: false,
        dts: false,
        deps: { alwaysBundle: [/.*/], onlyBundle: allowedPackages },
        logLevel: 'silent',
      });
      const chunks = bundles
        .flatMap((result) => result.chunks)
        .filter((chunk) => chunk.type === 'chunk');
      expect(chunks.length).toBeGreaterThan(0);
      const files = readdirSync(outDir, { recursive: true }).filter((file) =>
        /\.[cm]?js$/.test(String(file))
      );
      expect(files.length).toBe(chunks.length);
      for (const chunk of chunks) {
        for (const id of Object.keys(chunk.modules)) {
          expect(id).not.toMatch(
            /[/\\\\](?:cli|openid-client|open|keytar)[/\\\\]/
          );
        }
        for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) {
          expect(
            chunks.some((output) => output.fileName === dependency),
            `unexpected external: ${dependency}`
          ).toBe(true);
        }
        for (const specifier of imports(chunk.code)) {
          expect(
            specifier.startsWith('.'),
            `unexpected external: ${specifier}`
          ).toBe(true);
          expect(
            existsSync(resolve(outDir, dirname(chunk.fileName), specifier)),
            specifier
          ).toBe(true);
        }
      }
      const code = chunks.map((chunk) => chunk.code).join('\n');
      const measurements = chunks.map((chunk) => ({
        file: chunk.fileName,
        bytes: Buffer.byteLength(chunk.code),
        brotli: brotliCompressSync(chunk.code).length,
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        modules: Object.keys(chunk.modules).map((id) =>
          id.replace(fixture, '<fixture>')
        ),
      }));
      const totals = {
        bytes: measurements.reduce((sum, item) => sum + item.bytes, 0),
        brotli: measurements.reduce((sum, item) => sum + item.brotli, 0),
      };
      process.stdout.write(
        `Artifact ${name}: ${JSON.stringify({ ...totals, chunks: measurements })}\n`
      );
      return { code, chunks, outDir, totals };
    }
    for (const name of Object.keys(sources) as (keyof typeof sources)[]) {
      const result = await bundle(name);
      expect(result.totals.bytes, `${name} minified bytes`).toBeLessThanOrEqual(
        limits[name][0]
      );
      expect(result.totals.brotli, `${name} Brotli bytes`).toBeLessThanOrEqual(
        limits[name][1]
      );
      if (name === 'facade') {
        expect(result.code).toContain(adapterMarker);
        expect(result.code).toContain(projectPath);
        expect(result.code).toContain(tagPath);
        expect(result.code).toContain(translationPath);
      } else {
        assertIsolation(
          result.code,
          name === 'constants'
            ? []
            : [name === 'rawTag' ? tagPath : translationPath],
          name === 'runtime'
        );
      }
      if (name === 'runtime') expect(result.code).toContain(classMarker);
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `
        import assert from 'node:assert/strict';
        const requests = [];
        globalThis.fetch = async (input, init) => {
          const request = new Request(input, init);
          requests.push(new URL(request.url).pathname);
          if (request.url.includes('/project/info/')) return Response.json({ projectId: 'project', defaultLocale: 'en', currentLocales: ['es'] });
          if (request.url.includes('/tags/create')) return Response.json({ tag: { id: 'id', tagId: 'tag', message: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' } });
          const body = await request.json();
          return Response.json(Object.fromEntries(Object.keys(body.requests).map(key => [key,
            { success: true, translation: 'Hola', locale: 'es', dataFormat: 'STRING' }])));
        };
        const { run } = await import('./${name}.mjs');
        const result = await run();
        assert.ok(result);
        assert.deepEqual(requests, ${JSON.stringify(name === 'constants' ? [] : [name === 'rawTag' ? tagPath : name === 'facade' ? '/v2/project/info/project' : translationPath])});
        ${['runtime', 'named'].includes(name) ? `assert.equal(result[0].translation, 'Hola');` : ''}
      `,
        ],
        { cwd: result.outDir, stdio: 'pipe' }
      );
    }
    // Inspect every shared chunk as well. Do not mix class-requesting consumers
    // into the class-free control: bundlers may legitimately coalesce their code.
    for (const name of ['named', 'runtime'] as const) {
      writeFileSync(join(fixture, `${name}Twin.mjs`), sources[name]);
      const split = await bundle(`${name}Split`, [name, `${name}Twin`]);
      expect(split.chunks.length).toBeGreaterThan(2);
      assertIsolation(split.code, [translationPath], name === 'runtime');
      expect(split.totals.bytes).toBeLessThanOrEqual(limits[name][0]);
      expect(split.totals.brotli).toBeLessThanOrEqual(limits[name][1]);
    }

    // A live forbidden import must trip the same assertion; never touch production.
    writeFileSync(
      join(fixture, 'forbidden.mjs'),
      `${sources.named}\nexport { run as management } from './facade.mjs';`
    );
    const forbidden = await bundle('forbidden');
    expect(forbidden.code).toContain(projectPath);
    expect(() => assertIsolation(forbidden.code, [translationPath])).toThrow(
      adapterMarker
    );
    rmSync(join(fixture, 'forbidden.mjs'));
    process.stdout.write(
      'Isolation negative control: rejected temporary management dependency; removed fixture.\n'
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 120_000);
