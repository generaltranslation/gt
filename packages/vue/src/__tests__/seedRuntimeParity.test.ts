import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { hashSource } from 'generaltranslation/id';
import type { JsxChildren } from 'generaltranslation/types';
import {
  DiagnosticCategory,
  JsxEmit,
  ModuleKind,
  ScriptTarget,
  formatDiagnostics,
  transpileModule,
} from 'typescript';
import * as Vue from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import * as ReactCoreSource from '../../../react-core/src/components';
import { prepareT } from '../../../react-core/src/utils/translation/prepareT.shared';
import * as GTVue from '../index';
import { serializeVueChildren } from '../rendering/translateVueChildren';

type ParityMode = 'semantic-wire-exact' | 'expected-failure' | 'excluded';

type SemanticWireRepair = {
  after: unknown;
  before: unknown;
  path: (number | string)[];
};

type ParitySeedBase = {
  context?: string;
  hash: string;
  id: string;
  mode: ParityMode;
  reason: string;
};

type ExpectedFailureSeed = ParitySeedBase & {
  brokenVueHash: string;
  mode: 'expected-failure';
  repairs: SemanticWireRepair[];
};

type ParitySeed =
  | ExpectedFailureSeed
  | (ParitySeedBase & {
      mode: Exclude<ParityMode, 'expected-failure'>;
    });

type CompiledSeed = {
  filename: string;
  javascript: string;
};

type ReactBoundaryElement = {
  props: {
    children?: unknown;
    context?: unknown;
  };
  type: unknown;
};

type ReactRuntime = {
  isValidElement: (value: unknown) => boolean;
};

type VueSetupComponent = {
  setup?: (
    props: Record<string, unknown>,
    context: {
      attrs: Record<string, unknown>;
      emit: () => void;
      expose: () => void;
      slots: Record<string, never>;
    }
  ) => unknown;
};

const repositoryRoot = path.resolve(__dirname, '../../../..');
const requireFromReactCore = createRequire(
  path.join(repositoryRoot, 'packages/react-core/package.json')
);
const React = requireFromReactCore('react') as ReactRuntime;
const ReactJsxRuntime = requireFromReactCore('react/jsx-runtime') as Record<
  string,
  unknown
>;
const seedRoot = path.join(repositoryRoot, 'tests/seeds');
const manifestPath = path.join(
  repositoryRoot,
  'test-fixtures/react-vue-runtime-parity.json'
);
const manifest = readManifest(manifestPath);
const runnableSeeds = manifest.filter(({ mode }) => mode !== 'excluded');
const semanticWireExactSeeds = manifest.filter(
  ({ mode }) => mode === 'semantic-wire-exact'
);
const expectedFailureSeeds = manifest.filter(
  (fixture): fixture is ExpectedFailureSeed =>
    fixture.mode === 'expected-failure'
);
const excludedSeeds = manifest.filter(({ mode }) => mode === 'excluded');
const expectedSourceCache = new Map<string, JsxChildren>();
const reactSourceCache = new Map<string, JsxChildren>();
const vueSourceCache = new Map<string, JsxChildren>();

/** Boundary identity substituted only while evaluating a compiled seed. */
function ReactTBoundary(): null {
  return null;
}

/** Named stand-in for a seed child that prepareT inspects but never renders. */
function LocaleSelector(): null {
  return null;
}

/** Boundary identity substituted only while evaluating a compiled seed. */
const VueTBoundary = Vue.defineComponent({
  name: 'SeedTBoundary',
  render: () => null,
});

const reactSeedImports = Object.freeze({
  ...ReactCoreSource,
  LocaleSelector,
  T: ReactTBoundary,
});
const vueSeedImports = Object.freeze({
  ...GTVue,
  T: VueTBoundary,
});

describe('React and Vue seed runtime parity', () => {
  it('accounts for every paired seed exactly once in sorted order', () => {
    const ids = manifest.map(({ id }) => id);

    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(collectPairedSeedIds(seedRoot));
    for (const fixture of manifest) {
      expect(fixture.reason).toBe(fixture.reason.trim());
      expect(fixture.reason.length).toBeGreaterThan(0);
    }
  });

  describe('checked-in expected catalog hashes', () => {
    for (const fixture of manifest) {
      it(`${fixture.id}: ${fixture.hash}`, () => {
        expect(sourceHash(getExpectedSource(fixture), fixture)).toBe(
          fixture.hash
        );
      });
    }
  });

  describe('React runtime oracle', () => {
    for (const fixture of runnableSeeds) {
      it(`${fixture.id}: ${fixture.reason}`, () => {
        assertReactRuntimeOracle(fixture);
      });
    }
  });

  describe('semantic-wire-exact runtime sources', () => {
    for (const fixture of semanticWireExactSeeds) {
      it(`${fixture.id}: ${fixture.reason}`, () => {
        assertVueRuntimeParity(fixture);
      });
    }
  });

  describe('repairable runtime mismatches', () => {
    for (const fixture of expectedFailureSeeds) {
      it(`${fixture.id} is limited to its declared semantic repairs`, () => {
        const vueSource = getVueSource(fixture);
        const repairedVueSource = applySemanticWireRepairs(
          toSemanticWireSource(vueSource),
          fixture.repairs
        );

        expect(sourceHash(vueSource, fixture)).toBe(fixture.brokenVueHash);
        expect(repairedVueSource).toStrictEqual(
          toSemanticWireSource(getExpectedSource(fixture))
        );
      });

      it(`${fixture.id} compiles and serializes in both runtimes`, () => {
        expect(getReactSource(fixture)).toBeDefined();
        expect(getVueSource(fixture)).toBeDefined();
      });

      it.fails(`${fixture.id}: ${fixture.reason}`, () => {
        assertVueRuntimeParity(fixture);
      });
    }
  });

  describe('explicitly excluded seeds', () => {
    for (const fixture of excludedSeeds) {
      it(`${fixture.id}: ${fixture.reason}`, () => {
        const directory = seedDirectory(fixture);
        const reactCompilation = compileReactSeed(fixture);
        const vueCompilation = compileVueSeed(fixture);

        expect(fixture.mode).toBe('excluded');
        expect(fixture.reason).toBe(fixture.reason.trim());
        expect(fixture.reason.length).toBeGreaterThan(0);
        expect(fs.existsSync(path.join(directory, 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(directory, 'page.vue'))).toBe(true);
        expect(reactCompilation.javascript.length).toBeGreaterThan(0);
        expect(vueCompilation.javascript.length).toBeGreaterThan(0);
      });
    }
  });
});

/** Pins React runtime semantics and hash to the checked-in catalog oracle. */
function assertReactRuntimeOracle(fixture: ParitySeed): void {
  const expected = getExpectedSource(fixture);
  const source = getReactSource(fixture);

  expect(toSemanticWireSource(source)).toStrictEqual(
    toSemanticWireSource(expected)
  );
  expect(sourceHash(expected, fixture)).toBe(fixture.hash);
  expect(sourceHash(source, fixture)).toBe(fixture.hash);
}

/** Compares every Vue semantic wire field before checking the literal hash. */
function assertVueRuntimeParity(fixture: ParitySeed): void {
  const expected = getExpectedSource(fixture);
  const vueSource = getVueSource(fixture);

  expect(toSemanticWireSource(vueSource)).toStrictEqual(
    toSemanticWireSource(expected)
  );
  expect(sourceHash(vueSource, fixture)).toBe(fixture.hash);
}

/**
 * Canonicalizes a runtime source to its persisted rich-content wire form.
 *
 * React derives these labels from function names, which production minifiers
 * are free to rewrite. GT hashing already excludes them, and both renderers
 * reconcile translated elements by `i`. The branch/plural discriminator at
 * `d.t`, element IDs, variables, content props, branches, and children remain
 * part of this comparison. Undefined object properties are also omitted
 * because JSON catalogs cannot represent them; array positions and holes are
 * deliberately left untouched.
 */
function toSemanticWireSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSemanticWireSource);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, child]) =>
          child !== undefined &&
          (key !== 't' || !('i' in value) || 'k' in value)
      )
      .map(([key, child]) => [key, toSemanticWireSource(child)])
  );
}

/** Applies declared, narrowly checked repairs to one known broken Vue source. */
function applySemanticWireRepairs(
  source: unknown,
  repairs: SemanticWireRepair[]
): unknown {
  const repaired = structuredClone(source);

  for (const repair of repairs) {
    const lastSegment = repair.path.at(-1);
    invariant(
      lastSegment !== undefined,
      'A semantic repair path cannot be empty'
    );
    let parent = repaired;
    for (const segment of repair.path.slice(0, -1)) {
      parent = readWirePath(parent, segment);
    }
    const before = readWirePath(parent, lastSegment);
    expect(before).toStrictEqual(repair.before);
    writeWirePath(parent, lastSegment, structuredClone(repair.after));
  }

  return repaired;
}

function readWirePath(parent: unknown, segment: number | string): unknown {
  if (Array.isArray(parent)) {
    invariant(
      typeof segment === 'number',
      'Array wire paths must use numeric segments'
    );
    return parent[segment];
  }
  invariant(isRecord(parent), 'A wire repair path must traverse objects');
  invariant(
    typeof segment === 'string',
    'Object wire paths must use string segments'
  );
  invariant(
    Object.prototype.hasOwnProperty.call(parent, segment),
    `Wire repair path is missing ${segment}`
  );
  return parent[segment];
}

function writeWirePath(
  parent: unknown,
  segment: number | string,
  value: unknown
): void {
  if (Array.isArray(parent)) {
    invariant(
      typeof segment === 'number',
      'Array wire paths must use numeric segments'
    );
    parent[segment] = value;
    return;
  }
  invariant(isRecord(parent), 'A wire repair path must terminate in an object');
  invariant(
    typeof segment === 'string',
    'Object wire paths must use string segments'
  );
  parent[segment] = value;
}

function getExpectedSource(fixture: ParitySeed): JsxChildren {
  const cached = expectedSourceCache.get(fixture.id);
  if (cached !== undefined) return cached;

  const source = readJson(
    path.join(seedDirectory(fixture), 'expected.json')
  ) as JsxChildren;
  expectedSourceCache.set(fixture.id, source);
  return source;
}

function getReactSource(fixture: ParitySeed): JsxChildren {
  const cached = reactSourceCache.get(fixture.id);
  if (cached !== undefined) return cached;

  const { filename, javascript } = compileReactSeed(fixture);
  const module = evaluateCommonJs(javascript, filename, (specifier) => {
    if (specifier === 'gt-next') return reactSeedImports;
    if (specifier === 'react') return React;
    if (specifier === 'react/jsx-runtime') return ReactJsxRuntime;
    throw new Error(`${fixture.id} has unexpected React import: ${specifier}`);
  });
  const Page = module.default;
  invariant(
    typeof Page === 'function',
    `${fixture.id} must default-export a React page function`
  );
  const boundary = findReactBoundary((Page as () => unknown)(), fixture.id);
  invariant(
    boundary.props.context === fixture.context,
    `${fixture.id} React context must match its parity manifest`
  );
  const prepared = prepareT({
    locale: 'en',
    params: fixture.context === undefined ? {} : { context: fixture.context },
    sourceChildren: boundary.props.children as Parameters<
      typeof prepareT
    >[0]['sourceChildren'],
  });
  invariant(
    prepared.targetOptions.$context === fixture.context,
    `${fixture.id} React prepareT context must match its parity manifest`
  );
  const source = prepared.sourceJsxChildren;

  reactSourceCache.set(fixture.id, source);
  return source;
}

function getVueSource(fixture: ParitySeed): JsxChildren {
  const cached = vueSourceCache.get(fixture.id);
  if (cached !== undefined) return cached;

  const { filename, javascript } = compileVueSeed(fixture);
  const component = evaluateVueSfc(javascript, filename, (specifier) => {
    if (specifier === 'vue') return Vue;
    if (specifier === 'gt-vue') return vueSeedImports;
    throw new Error(`${fixture.id} has unexpected Vue import: ${specifier}`);
  });
  const rendered = renderCompiledVueComponent(component, fixture.id);
  const children = findVueBoundaryChildren(rendered, fixture);
  const runtimeSource = serializeVueChildren(children);

  vueSourceCache.set(fixture.id, runtimeSource);
  return runtimeSource;
}

/** Compiles a React seed without resolving or executing its imports. */
function compileReactSeed(fixture: ParitySeed): CompiledSeed {
  const filename = path.join(seedDirectory(fixture), 'page.tsx');
  return {
    filename,
    javascript: transpile(
      fs.readFileSync(filename, 'utf8'),
      filename,
      JsxEmit.ReactJSX
    ),
  };
}

/** Compiles a Vue SFC and its generated TypeScript without executing it. */
function compileVueSeed(fixture: ParitySeed): CompiledSeed {
  const filename = path.join(seedDirectory(fixture), 'page.vue');
  const source = fs.readFileSync(filename, 'utf8');
  const parsed = parse(source, { filename });
  invariant(
    parsed.errors.length === 0,
    `${fixture.id} Vue parse errors: ${parsed.errors.map(String).join('\n')}`
  );
  const compiled = compileScript(parsed.descriptor, {
    genDefaultAs: '__sfc__',
    id: `runtime-parity-${fixture.id.replaceAll('/', '-')}`,
    inlineTemplate: true,
  });
  return { filename, javascript: transpile(compiled.content, filename) };
}

function findReactBoundary(
  root: unknown,
  fixtureId: string
): ReactBoundaryElement {
  const boundaries: ReactBoundaryElement[] = [];

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!React.isValidElement(node)) return;
    const element = node as ReactBoundaryElement;
    if (element.type === ReactTBoundary) {
      boundaries.push(element);
      return;
    }
    visit(element.props.children);
  }

  visit(root);
  invariant(
    boundaries.length === 1,
    `${fixtureId} must render exactly one outer React T; found ${boundaries.length}`
  );
  return boundaries[0];
}

function renderCompiledVueComponent(
  component: Vue.Component,
  fixtureId: string
): unknown {
  const setup = (component as VueSetupComponent).setup;
  invariant(
    typeof setup === 'function',
    `${fixtureId} compiled Vue component must expose setup()`
  );
  const render = setup(
    {},
    {
      attrs: {},
      emit: () => undefined,
      expose: () => undefined,
      slots: {},
    }
  );
  invariant(
    typeof render === 'function',
    `${fixtureId} compiled Vue setup() must return a render function`
  );
  return (
    render as (context: Record<string, unknown>, cache: unknown[]) => unknown
  )({}, []);
}

function findVueBoundaryChildren(
  root: unknown,
  fixture: ParitySeed
): Vue.VNode[] {
  const fixtureId = fixture.id;
  const boundaries: Vue.VNode[] = [];

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!Vue.isVNode(node)) return;
    if (node.type === VueTBoundary) {
      boundaries.push(node);
      return;
    }
    if (Array.isArray(node.children)) visit(node.children);
  }

  visit(root);
  invariant(
    boundaries.length === 1,
    `${fixtureId} must render exactly one outer Vue T; found ${boundaries.length}`
  );
  const boundary = boundaries[0];
  invariant(
    boundary.props?.context === fixture.context,
    `${fixtureId} Vue context must match its parity manifest`
  );
  const slots = boundary.children;
  invariant(
    isRecord(slots) && typeof slots.default === 'function',
    `${fixtureId} compiled Vue T must provide a default slot`
  );
  const children = (slots.default as () => unknown)();
  invariant(
    Array.isArray(children),
    `${fixtureId} compiled Vue T default slot must return an array`
  );
  return children as Vue.VNode[];
}

function transpile(source: string, filename: string, jsx?: JsxEmit): string {
  const result = transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      ...(jsx === undefined ? {} : { jsx }),
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors =
    result.diagnostics?.filter(
      ({ category }) => category === DiagnosticCategory.Error
    ) ?? [];
  invariant(errors.length === 0, formatDiagnostics(errors, formatHost));
  return result.outputText;
}

function evaluateCommonJs(
  javascript: string,
  filename: string,
  requireModule: (specifier: string) => unknown
): Record<string, unknown> {
  const commonJsModule = { exports: {} as Record<string, unknown> };
  const evaluate = new Function(
    'require',
    'exports',
    'module',
    `${javascript}\n//# sourceURL=${filename}`
  ) as (
    require: (specifier: string) => unknown,
    exports: Record<string, unknown>,
    module: { exports: Record<string, unknown> }
  ) => void;

  evaluate(requireModule, commonJsModule.exports, commonJsModule);
  return commonJsModule.exports;
}

function evaluateVueSfc(
  javascript: string,
  filename: string,
  requireModule: (specifier: string) => unknown
): Vue.Component {
  const evaluate = new Function(
    'require',
    'exports',
    `${javascript}\nreturn __sfc__;\n//# sourceURL=${filename}`
  ) as (
    require: (specifier: string) => unknown,
    exports: Record<string, unknown>
  ) => Vue.Component;

  return evaluate(requireModule, {});
}

function sourceHash(source: JsxChildren, fixture: ParitySeed): string {
  return hashSource({
    context: fixture.context,
    dataFormat: 'JSX',
    source,
  });
}

function seedDirectory({ id }: ParitySeed): string {
  return path.join(seedRoot, id);
}

function readManifest(filename: string): ParitySeed[] {
  const value = readJson(filename);
  invariant(Array.isArray(value), 'Runtime parity manifest must be an array');

  return value.map((entry, index) => {
    invariant(isRecord(entry), `Manifest entry ${index} must be an object`);
    invariant(
      entry.mode === 'semantic-wire-exact' ||
        entry.mode === 'expected-failure' ||
        entry.mode === 'excluded',
      `Manifest entry ${index} has an invalid parity mode`
    );
    const expectedKeys = [
      ...(entry.mode === 'expected-failure'
        ? ['brokenVueHash', 'repairs']
        : []),
      ...('context' in entry ? ['context'] : []),
      'hash',
      'id',
      'mode',
      'reason',
    ].sort();
    invariant(
      JSON.stringify(Object.keys(entry).sort()) ===
        JSON.stringify(expectedKeys),
      `Manifest entry ${index} has fields that do not match its parity mode`
    );
    if ('context' in entry) {
      invariant(
        typeof entry.context === 'string' && entry.context.length > 0,
        `Manifest entry ${index} must have a static nonempty context`
      );
    }
    invariant(
      typeof entry.hash === 'string' && /^[0-9a-f]{16}$/.test(entry.hash),
      `Manifest entry ${index} must have a 16-character lowercase hexadecimal hash`
    );
    invariant(
      typeof entry.id === 'string' &&
        entry.id.length > 0 &&
        !path.isAbsolute(entry.id) &&
        !entry.id.split('/').includes('..') &&
        !entry.id.includes('\\'),
      `Manifest entry ${index} has an invalid seed id`
    );
    invariant(
      typeof entry.reason === 'string' &&
        entry.reason.length > 0 &&
        entry.reason === entry.reason.trim(),
      `Manifest entry ${index} must have a precise nonempty reason`
    );
    if (entry.mode === 'expected-failure') {
      invariant(
        typeof entry.brokenVueHash === 'string' &&
          /^[0-9a-f]{16}$/.test(entry.brokenVueHash),
        `Manifest entry ${index} must pin its broken Vue hash`
      );
      invariant(
        Array.isArray(entry.repairs) && entry.repairs.length > 0,
        `Manifest entry ${index} must declare its semantic repairs`
      );
      const repairPaths = entry.repairs.map((repair, repairIndex) => {
        invariant(
          isRecord(repair) &&
            JSON.stringify(Object.keys(repair).sort()) ===
              JSON.stringify(['after', 'before', 'path']),
          `Manifest entry ${index} repair ${repairIndex} has invalid fields`
        );
        invariant(
          Array.isArray(repair.path) &&
            repair.path.length > 0 &&
            repair.path.every(
              (segment) =>
                (typeof segment === 'number' &&
                  Number.isSafeInteger(segment) &&
                  segment >= 0) ||
                (typeof segment === 'string' &&
                  segment.length > 0 &&
                  segment !== '__proto__' &&
                  segment !== 'constructor' &&
                  segment !== 'prototype')
            ),
          `Manifest entry ${index} repair ${repairIndex} has an invalid path`
        );
        return JSON.stringify(repair.path);
      });
      invariant(
        new Set(repairPaths).size === repairPaths.length,
        `Manifest entry ${index} must not repair the same path twice`
      );
    }
    return entry as ParitySeed;
  });
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
}

function collectPairedSeedIds(directory: string): string[] {
  const ids: string[] = [];

  function visit(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    const files = new Set(
      entries.filter((entry) => entry.isFile()).map(({ name }) => name)
    );
    if (files.has('page.tsx') && files.has('page.vue')) {
      ids.push(path.relative(directory, current).replaceAll(path.sep, '/'));
    }
    for (const entry of entries) {
      if (entry.isDirectory()) visit(path.join(current, entry.name));
    }
  }

  visit(directory);
  return ids.sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const formatHost = {
  getCanonicalFileName: (filename: string) => filename,
  getCurrentDirectory: () => repositoryRoot,
  getNewLine: () => '\n',
};
