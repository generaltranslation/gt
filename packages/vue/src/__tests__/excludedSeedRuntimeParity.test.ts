import fs from 'node:fs';
import path from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import * as Vue from 'vue';
import { createSSRApp, type Component } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import * as GTVue from '../index';

type ParitySeed = {
  id: string;
  mode: 'excluded' | 'semantic-wire-exact';
  reason: string;
};

type SuccessfulSeedExpectation = {
  /** Stable catalog hash calculated from the Vue-specific source. */
  hash: string;
  /** Source checked independently by the Vue extractor package. */
  source: unknown;
};

type RejectedSeedExpectation = {
  errorCount: number;
  errors: string[];
};

type SeedExpectation = RejectedSeedExpectation | SuccessfulSeedExpectation;

type ExcludedFixture = {
  expectation: SeedExpectation;
  fixturePath: string;
  seed: ParitySeed;
};

type SuccessfulFixture = ExcludedFixture & {
  expectation: SuccessfulSeedExpectation;
};

const repositoryRoot = path.resolve(__dirname, '../../../..');
const seedRoot = path.join(repositoryRoot, 'tests/seeds');
const manifestPath = path.join(
  repositoryRoot,
  'test-fixtures/react-vue-runtime-parity.json'
);
const fixtures = readManifest(manifestPath)
  .filter(({ mode }) => mode === 'excluded')
  .map((seed): ExcludedFixture => {
    const directory = path.join(seedRoot, seed.id);
    return {
      expectation: readJson(
        path.join(directory, 'expected.vue.json')
      ) as SeedExpectation,
      fixturePath: path.join(directory, 'page.vue'),
      seed,
    };
  });
const successfulFixtures = fixtures.filter(isSuccessfulFixture);

describe('excluded Vue seed runtime parity', () => {
  for (const fixture of successfulFixtures) {
    it(`${fixture.seed.id}: ${fixture.seed.reason}`, async () => {
      const component = compileSfcFixture(fixture.fixturePath);
      const translated = `translated-${fixture.expectation.hash}`;
      const plugin = GTVue.createGT({
        defaultLocale: 'en',
        loadTranslations: async () => ({
          [fixture.expectation.hash]: translated,
        }),
        locale: 'fr',
      });

      await plugin.loadTranslations('fr');
      const app = createSSRApp(component);
      app.use(plugin);

      expect(stripFragmentMarkers(await renderToString(app))).toBe(translated);
    });
  }
});

/** Compiles and evaluates one complete script-setup SFC as Vue tooling does. */
function compileSfcFixture(filename: string): Component {
  const source = fs.readFileSync(filename, 'utf8');
  const parsed = parse(source, { filename });
  expect(parsed.errors, filename).toEqual([]);

  const compiled = compileScript(parsed.descriptor, {
    genDefaultAs: '__sfc__',
    id: `excluded-seed-${path.relative(seedRoot, filename)}`,
    inlineTemplate: true,
  });
  const javascript = transpileModule(compiled.content, {
    compilerOptions: {
      esModuleInterop: true,
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const evaluate = new Function(
    'require',
    'exports',
    `${javascript}\nreturn __sfc__;`
  ) as (
    requireModule: (specifier: string) => unknown,
    exports: Record<string, unknown>
  ) => Component;

  return evaluate((specifier) => {
    if (specifier === 'vue') return Vue;
    if (specifier === 'gt-vue') return GTVue;
    throw new Error(`Unexpected seed import: ${specifier}`);
  }, {});
}

/** Removes only the hydration anchors introduced by T's Fragment root. */
function stripFragmentMarkers(html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '');
}

/** Reads only the parity-manifest fields owned by this runtime smoke. */
function readManifest(filename: string): ParitySeed[] {
  const value = readJson(filename);
  invariant(Array.isArray(value), 'Runtime parity manifest must be an array');

  return value.map((entry, index) => {
    invariant(isRecord(entry), `Manifest entry ${index} must be an object`);
    invariant(typeof entry.id === 'string', `Manifest entry ${index} needs id`);
    invariant(
      entry.mode === 'excluded' || entry.mode === 'semantic-wire-exact',
      `Manifest entry ${index} has an invalid parity mode`
    );
    invariant(
      typeof entry.reason === 'string',
      `Manifest entry ${index} needs reason`
    );
    return {
      id: entry.id,
      mode: entry.mode,
      reason: entry.reason,
    };
  });
}

/** Narrows a fixture to one carrying an actual Vue runtime hash. */
function isSuccessfulFixture(
  fixture: ExcludedFixture
): fixture is SuccessfulFixture {
  return !isRejectedExpectation(fixture.expectation);
}

/** Distinguishes the one rejected seed from runtime-compatible fixtures. */
function isRejectedExpectation(
  expectation: SeedExpectation
): expectation is RejectedSeedExpectation {
  return 'errors' in expectation;
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
