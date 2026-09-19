import { execFileSync } from 'node:child_process';
import {
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
import ts from 'typescript';
import { expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const adapterMarker = 'call configureApiClient first';
const projectPath = '/v2/project/info/{projectId}';
const config = `{ projectId: 'project', apiKey: 'key', baseUrl: 'https://example.test' }`;

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

it('loads packed ESM/CJS, typechecks NodeNext declarations and keeps the published runtime free of management', () => {
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
      import type { TranslateManyResult, TranslateOptions, TranslationResult } from 'generaltranslation/types';
      import { API_VERSION } from 'generaltranslation/api';
      const config = { projectId: 'project', apiKey: 'key', baseUrl: 'https://example.test', timeoutMs: false, fetch, apiVersion: API_VERSION } satisfies TranslateConfig;
      const options = { targetLocale: 'es' } satisfies TranslateOptions;
      const array: Promise<TranslateManyResult> = translateMany(['Hello'], options, config);
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
    execFileSync(
      process.execPath,
      [
        join(packageRoot, 'node_modules/typescript/bin/tsc'),
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
      ],
      { cwd: fixture, stdio: 'inherit' }
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 120_000);
