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
import { extractFromVueSource } from '../../../vue-extractor/src/internal/__tests__/testVueCompiler';
import {
  MINIMUM_EXACT_SEED_COUNT,
  NON_PORTABLE_SEEDS,
  type NonPortableSeed,
} from '../../../../test-fixtures/react-vue-seed-contract';
import { initializeI18nConfig as initializeReactI18nConfig } from '@generaltranslation/react-core/pure';
import * as ReactCoreSource from '../../../react-core/src/components';
import { prepareT } from '../../../react-core/src/utils/translation/prepareT.shared';
import * as GTVue from '../index';
import { serializeVueChildren } from '../rendering/translateVueChildren';

initializeReactI18nConfig({ defaultLocale: 'en' });

type ParitySeed = {
  id: string;
};

type CompiledSeed = {
  filename: string;
  javascript: string;
};

type PreparedSeed = {
  context?: string;
  source: JsxChildren;
};

type ReactBoundaryElement = {
  props: {
    children?: unknown;
    context?: unknown;
  };
  type: unknown;
};

type ReactRuntime = {
  Fragment: unknown;
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown;
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
const reactSeedIds = collectSeedIds(seedRoot, 'page.tsx');
const vueSeedIds = collectSeedIds(seedRoot, 'page.vue');
const fixtures = reactSeedIds.map((id): ParitySeed => ({ id }));
const nonPortableById = new Map(
  NON_PORTABLE_SEEDS.map((fixture) => [fixture.id, fixture])
);
const exactSeeds = fixtures.filter(({ id }) => !nonPortableById.has(id));
const emptyReactVariableNameSeed = 'complex-cases/more-extreme-edge-cases';
const expectedSourceCache = new Map<string, unknown>();
const reactSourceCache = new Map<string, PreparedSeed>();
const vueSourceCache = new Map<string, PreparedSeed>();

/** Boundary identity substituted only while evaluating a compiled seed. */
function ReactTBoundary(): null {
  return null;
}

/** Named stand-in for a seed child that prepareT inspects but never renders. */
function LocaleSelector(): null {
  return null;
}

/** Named stand-in whose authored children remain visible to prepareT. */
function Link(): null {
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
const reactRuntimeModule = Object.freeze({
  ...(React as unknown as Record<string, unknown>),
  useState: <T>(initial: T) => [initial, () => undefined] as const,
});
const vueSeedImports = Object.freeze({
  ...GTVue,
  T: VueTBoundary,
});

describe('React and Vue seed runtime parity', () => {
  it('pairs every one of the 84 React seeds with a Vue seed', () => {
    expect(reactSeedIds).toHaveLength(84);
    expect(vueSeedIds).toEqual(reactSeedIds);
  });

  it('keeps the non-portable allowlist narrow, sorted, and exhaustive', () => {
    const ids = NON_PORTABLE_SEEDS.map(({ id }) => id);

    expect(ids).toHaveLength(24);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => reactSeedIds.includes(id))).toBe(true);
    expect(exactSeeds.length).toBeGreaterThanOrEqual(MINIMUM_EXACT_SEED_COUNT);
  });

  describe('React prepareT oracle for every seed', () => {
    for (const fixture of fixtures) {
      it(fixture.id, () => {
        assertReactRuntimeOracle(fixture);
      });
    }
  });

  describe('exact Vue runtime source and hash', () => {
    for (const fixture of exactSeeds) {
      it(fixture.id, () => {
        assertVueRuntimeParity(fixture);
      });
    }
  });

  describe('non-portable reason evidence', () => {
    for (const fixture of NON_PORTABLE_SEEDS) {
      it(`${fixture.id}: ${fixture.reason}`, () => {
        assertNonPortableEvidence(fixture);
      });
    }
  });

  describe('Vue extractor/runtime parity for every seed', () => {
    for (const fixture of fixtures) {
      it(fixture.id, async () => {
        const filename = path.join(seedDirectory(fixture), 'page.vue');
        const output = await extractFromVueSource(
          fs.readFileSync(filename, 'utf8'),
          filename,
          { projectRoot: repositoryRoot }
        );
        const results = output.results.filter(
          ({ dataFormat }) => dataFormat === 'JSX'
        );
        const runtime = getVueSource(fixture);

        expect(output.errors).toEqual([]);
        expect(output.warnings).toEqual([]);
        expect(results).toHaveLength(1);
        expect(results[0]!.metadata.context).toBe(runtime.context);
        expect(toSemanticWireSource(results[0]!.source)).toStrictEqual(
          toSemanticWireSource(runtime.source)
        );
        expect(
          sourceHash(results[0]!.source, results[0]!.metadata.context)
        ).toBe(sourceHash(runtime.source, runtime.context));
      });
    }
  });

  it('proves Vue display-string conversion erases primitive identity', () => {
    expect(Vue.toDisplayString(false)).toBe(Vue.toDisplayString('false'));
    expect(Vue.toDisplayString(true)).toBe(Vue.toDisplayString('true'));
    expect(Vue.toDisplayString(null)).toBe(Vue.toDisplayString(undefined));
    expect(Vue.toDisplayString(null)).toBe(Vue.toDisplayString(''));
  });

  describe('programmatic React-authoritative shape boundaries', () => {
    it('collapses the default-slot wrapper around one custom-component child', () => {
      function Card(): null {
        return null;
      }
      const VueCard = Vue.defineComponent({ name: 'Card', render: () => null });
      const react = prepareProgrammaticReactChildren(
        React.createElement(Card, null, React.createElement('b', null, 'Hello'))
      );
      const vue = serializeProgrammaticVueChildren([
        Vue.h(VueCard, null, {
          default: () => [Vue.h('b', null, 'Hello')],
        }),
      ]);
      const expected: JsxChildren = {
        t: 'Card',
        i: 1,
        c: { t: 'b', i: 2, c: 'Hello' },
      };

      assertExactProgrammaticParity(react, vue, expected, '1c3760937a26bcbd');
    });

    it('preserves nested array cardinality and a zero inside an element', () => {
      const react = prepareProgrammaticReactChildren(
        React.createElement('div', null, [[0]])
      );
      const vue = serializeProgrammaticVueChildren([Vue.h('div', null, [[0]])]);
      const expected: JsxChildren = {
        t: 'div',
        i: 1,
        c: ['0'],
      };

      assertExactProgrammaticParity(react, vue, expected, 'c9c9cd7f3378429f');
    });

    it('uses React truthiness for scalar Fragment children', () => {
      const reactNumber = prepareProgrammaticReactChildren(
        React.createElement(React.Fragment, null, 0)
      );
      const vueNumber = serializeProgrammaticVueChildren([
        Vue.h(Vue.Fragment, null, { default: () => 0 }),
      ]);
      const reactString = prepareProgrammaticReactChildren(
        React.createElement(React.Fragment, null, '0')
      );
      const vueString = serializeProgrammaticVueChildren([
        Vue.h(Vue.Fragment, null, { default: () => '0' }),
      ]);

      assertExactProgrammaticParity(
        reactNumber,
        vueNumber,
        { t: 'C1', i: 1 },
        'a013c005483cdd19'
      );
      assertExactProgrammaticParity(
        reactString,
        vueString,
        { t: 'C1', i: 1, c: '0' },
        '246d388a23db9248'
      );
    });

    it('distinguishes a missing root from an explicitly empty root', () => {
      const reactMissing = prepareProgrammaticReactChildren(undefined);
      const vueMissing = serializeProgrammaticVueChildren(undefined);
      const reactEmpty = prepareProgrammaticReactChildren([]);
      // Vue's JSX/SFC slot contract wraps authored children once. An authored
      // empty array therefore reaches T as `[[]]`; a bare `[]` is the missing
      // slot wrapper covered by `vueMissing` above.
      const vueEmpty = serializeProgrammaticVueChildren([[]]);

      expect(reactMissing).toBeUndefined();
      expect(vueMissing).toBeUndefined();
      expect(sourceHash(reactMissing)).toBe('309dc626c8db3d4c');
      expect(sourceHash(vueMissing)).toBe('309dc626c8db3d4c');
      assertExactProgrammaticParity(
        reactEmpty,
        vueEmpty,
        [],
        'bdb7cc7686d0e468'
      );
    });

    it('preserves an authored root array across extraction and runtime', async () => {
      const output = await extractFromVueSource(
        `
          import { T } from 'gt-vue';
          export const View = () => <T>{[<b key="one">Hello</b>]}</T>;
        `,
        '/project/src/RootArray.tsx',
        { projectRoot: '/project' }
      );

      const expected = [{ t: 'b', i: 1, c: 'Hello' }] satisfies JsxChildren;
      const runtime = serializeProgrammaticVueChildren([
        [Vue.h('b', { key: 'one' }, 'Hello')],
      ]);

      expect(output.errors).toEqual([]);
      expect(output.results).toHaveLength(1);
      expect(toSemanticWireSource(output.results[0]?.source)).toStrictEqual(
        toSemanticWireSource(expected)
      );
      assertExactProgrammaticParity(
        prepareProgrammaticReactChildren([
          React.createElement('b', { key: 'one' }, 'Hello'),
        ]),
        runtime,
        expected,
        '3bfbeb8ed305dcfb'
      );
    });
  });
});

/** Prepares an arbitrary React child shape through the authoritative runtime. */
function prepareProgrammaticReactChildren(
  sourceChildren: unknown
): JsxChildren {
  return prepareT({
    locale: 'en',
    params: {},
    sourceChildren: sourceChildren as Parameters<
      typeof prepareT
    >[0]['sourceChildren'],
  }).sourceJsxChildren;
}

/** Calls the Vue serializer without erasing a deliberately missing root. */
function serializeProgrammaticVueChildren(children: unknown): JsxChildren {
  return serializeVueChildren(
    children as Parameters<typeof serializeVueChildren>[0]
  );
}

/** Pins semantic wire shape and hash on both sides of a programmatic boundary. */
function assertExactProgrammaticParity(
  react: JsxChildren,
  vue: JsxChildren,
  expected: JsxChildren,
  expectedHash: string
): void {
  const semanticExpected = toSemanticWireSource(expected);

  expect(toSemanticWireSource(react)).toStrictEqual(semanticExpected);
  expect(toSemanticWireSource(vue)).toStrictEqual(semanticExpected);
  expect(sourceHash(react)).toBe(expectedHash);
  expect(sourceHash(vue)).toBe(expectedHash);
}

/** Pins React runtime semantics and hash to the checked-in catalog oracle. */
function assertReactRuntimeOracle(fixture: ParitySeed): void {
  const expected = getExpectedSource(fixture);
  const { context, source } = getReactSource(fixture);

  // The existing React compiler replaces an explicitly empty variable name
  // with its generated fallback, while prepareT preserves the authored empty
  // string. Keep the shared compiler fixture unchanged and pin that known
  // pre-existing divergence instead of changing React behavior in a Vue PR.
  if (fixture.id === emptyReactVariableNameSeed) {
    const runtimeWire = toSemanticWireSource(source);
    const catalogWire = toSemanticWireSource(expected);

    expect(collectVariableKeys(runtimeWire)).toContain('');
    expect(collectVariableKeys(catalogWire)).toContain('_gt_value_13');
    expect(normalizeEmptyReactVariableName(catalogWire)).toStrictEqual(
      runtimeWire
    );
    expect(sourceHash(source, context)).not.toBe(
      sourceHash(expected as JsxChildren, context)
    );
    return;
  }

  if (nonPortableById.get(fixture.id)?.reason === 'unsupported-derive') {
    const catalog = getDeriveCatalog(expected, fixture.id);
    const hash = sourceHash(source, context);

    expect(catalog).toHaveProperty(hash);
    expect(toSemanticWireSource(source)).toStrictEqual(
      toSemanticWireSource(catalog[hash])
    );
    return;
  }

  expect(toSemanticWireSource(source)).toStrictEqual(
    toSemanticWireSource(expected)
  );
  expect(sourceHash(source, context)).toBe(
    sourceHash(expected as JsxChildren, context)
  );
}

/** Normalizes the one known React compiler/runtime seed divergence. */
function normalizeEmptyReactVariableName(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeEmptyReactVariableName);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === 'k' && child === '_gt_value_13'
        ? ''
        : normalizeEmptyReactVariableName(child),
    ])
  );
}

/** Compares every Vue semantic wire field before checking the literal hash. */
function assertVueRuntimeParity(fixture: ParitySeed): void {
  const react = getReactSource(fixture);
  const vue = getVueSource(fixture);

  expect(vue.context).toBe(react.context);
  expect(toSemanticWireSource(vue.source)).toStrictEqual(
    toSemanticWireSource(react.source)
  );
  expect(sourceHash(vue.source, vue.context)).toBe(
    sourceHash(react.source, react.context)
  );
}

/** Proves each allowlisted boundary and rejects an accidental exact match. */
function assertNonPortableEvidence(fixture: NonPortableSeed): void {
  const reactSource = fs.readFileSync(
    path.join(seedDirectory(fixture), 'page.tsx'),
    'utf8'
  );
  const react = getReactSource(fixture);
  const vue = getVueSource(fixture);
  const reactHash = sourceHash(react.source, react.context);
  const vueHash = sourceHash(vue.source, vue.context);

  // The semantic assertions below prove the named boundary. Exact two-sided
  // hashes additionally make the exception fail when any unrelated wire node
  // changes, including for lossy compiler boundaries that cannot be reversed.
  expect(reactHash).toBe(fixture.reactHash);
  expect(vueHash).toBe(fixture.vueHash);

  expect(toSemanticWireSource(vue.source)).not.toStrictEqual(
    toSemanticWireSource(react.source)
  );

  if (fixture.reason === 'unsupported-derive') {
    expect(vueHash).not.toBe(reactHash);
    expect(reactSource).toMatch(/<Derive(?:\s|>)/);
    const catalog = getDeriveCatalog(getExpectedSource(fixture), fixture.id);
    expect(Object.keys(catalog).length).toBeGreaterThan(1);
    expect(catalog).toHaveProperty(reactHash);
    return;
  }
  if (fixture.reason === 'unsupported-named-variable') {
    expect(vueHash).not.toBe(reactHash);
    expect(reactSource).toMatch(
      /<(?:Currency|DateTime|Num|Var)\b[^>]*\bname\s*=/s
    );
    const reactVariableKeys = collectVariableKeys(react.source);
    const vueVariableKeys = collectVariableKeys(vue.source);

    expect(reactVariableKeys.length).toBeGreaterThan(0);
    expect(vueVariableKeys.length).toBeGreaterThan(0);
    expect(reactVariableKeys.some((key) => !isGeneratedVariableKey(key))).toBe(
      true
    );
    expect(vueVariableKeys.every(isGeneratedVariableKey)).toBe(true);
    return;
  }

  if (fixture.reason === 'vue-text-coalescing') {
    expect(vueHash).not.toBe(reactHash);
    const reactWire = toSemanticWireSource(react.source);
    const vueWire = toSemanticWireSource(vue.source);

    expect(countAdjacentStringBoundaries(reactWire)).toBeGreaterThan(
      countAdjacentStringBoundaries(vueWire)
    );
    expect(coalesceAdjacentStrings(vueWire)).toStrictEqual(
      coalesceAdjacentStrings(reactWire)
    );
    expect(compileVueSeed(fixture).javascript).toContain('toDisplayString');
    return;
  }

  const { javascript } = compileVueSeed(fixture);
  expect(javascript).toContain('toDisplayString');
}

/** Collects persisted variable names without normalizing away their contract. */
function collectVariableKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectVariableKeys);
  if (!isRecord(value)) return [];

  return [
    ...(typeof value.k === 'string' && typeof value.v === 'string'
      ? [value.k]
      : []),
    ...Object.values(value).flatMap(collectVariableKeys),
  ];
}

/** Matches the only variable-key form generated by the gt-vue runtime. */
function isGeneratedVariableKey(key: string): boolean {
  return /^_gt_(?:cost|date|n|value)_\d+$/.test(key);
}

/** Counts authored text boundaries that Vue's template compiler can erase. */
function countAdjacentStringBoundaries(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, child, index) =>
        count +
        (index > 0 &&
        typeof value[index - 1] === 'string' &&
        typeof child === 'string'
          ? 1
          : 0) +
        countAdjacentStringBoundaries(child),
      0
    );
  }
  if (!isRecord(value)) return 0;
  return Object.values(value).reduce(
    (count, child) => count + countAdjacentStringBoundaries(child),
    0
  );
}

/** Normalizes only adjacent text segmentation, preserving the rest of the wire. */
function coalesceAdjacentStrings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.reduce<unknown[]>((children, child) => {
      const normalized = coalesceAdjacentStrings(child);
      const previous = children.at(-1);

      if (typeof previous === 'string' && typeof normalized === 'string') {
        children[children.length - 1] = previous + normalized;
      } else {
        children.push(normalized);
      }
      return children;
    }, []);
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      coalesceAdjacentStrings(child),
    ])
  );
}

/** Reads the compiler-enumerated React sources used by a Derive seed. */
function getDeriveCatalog(
  expected: unknown,
  fixtureId: string
): Record<string, JsxChildren> {
  invariant(isRecord(expected), `${fixtureId} must contain a Derive catalog`);
  const catalog = expected.static === true ? expected.content : expected;
  invariant(isRecord(catalog), `${fixtureId} must contain Derive sources`);
  return catalog as Record<string, JsxChildren>;
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

function getExpectedSource(fixture: ParitySeed): unknown {
  const cached = expectedSourceCache.get(fixture.id);
  if (cached !== undefined) return cached;

  const source = readJson(path.join(seedDirectory(fixture), 'expected.json'));
  expectedSourceCache.set(fixture.id, source);
  return source;
}

function getReactSource(fixture: ParitySeed): PreparedSeed {
  const cached = reactSourceCache.get(fixture.id);
  if (cached !== undefined) return cached;

  const { filename, javascript } = compileReactSeed(fixture);
  const module = evaluateCommonJs(javascript, filename, (specifier) => {
    if (specifier === 'gt-next') return reactSeedImports;
    if (specifier === 'next/link') return { __esModule: true, default: Link };
    if (specifier === 'react') return reactRuntimeModule;
    if (specifier === 'react/jsx-runtime') return ReactJsxRuntime;
    throw new Error(`${fixture.id} has unexpected React import: ${specifier}`);
  });
  const Page = module.default;
  invariant(
    typeof Page === 'function',
    `${fixture.id} must default-export a React page function`
  );
  const boundary = findReactBoundary((Page as () => unknown)(), fixture.id);
  const context = boundary.props.context;
  invariant(
    context === undefined || typeof context === 'string',
    `${fixture.id} React T context must be a static string`
  );
  const prepared = prepareT({
    locale: 'en',
    params: context === undefined ? {} : { context },
    sourceChildren: boundary.props.children as Parameters<
      typeof prepareT
    >[0]['sourceChildren'],
  });
  invariant(
    prepared.targetOptions.$context === context,
    `${fixture.id} React prepareT must preserve its static context`
  );
  const result = { context, source: prepared.sourceJsxChildren };

  reactSourceCache.set(fixture.id, result);
  return result;
}

function getVueSource(fixture: ParitySeed): PreparedSeed {
  const cached = vueSourceCache.get(fixture.id);
  if (cached !== undefined) return cached;

  const { filename, javascript } = compileVueSeed(fixture);
  const component = evaluateVueSfc(javascript, filename, (specifier) => {
    if (specifier === 'vue') return Vue;
    if (specifier === 'gt-vue') return vueSeedImports;
    throw new Error(`${fixture.id} has unexpected Vue import: ${specifier}`);
  });
  const rendered = renderCompiledVueComponent(component, fixture.id);
  const boundary = findVueBoundary(rendered, fixture.id);
  const runtimeSource = serializeVueChildren(boundary.children);
  const result = { context: boundary.context, source: runtimeSource };

  vueSourceCache.set(fixture.id, result);
  return result;
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

function findVueBoundary(
  root: unknown,
  fixtureId: string
): { children: Vue.VNode[]; context?: string } {
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
  const context = boundary.props?.context;
  invariant(
    context === undefined || typeof context === 'string',
    `${fixtureId} Vue T context must be a static string`
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
  return { children: children as Vue.VNode[], context };
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

function sourceHash(source: JsxChildren, context?: string): string {
  return hashSource({
    context,
    dataFormat: 'JSX',
    source,
  });
}

function seedDirectory({ id }: ParitySeed): string {
  return path.join(seedRoot, id);
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
}

/** Recursively discovers one side of the React/Vue seed contract. */
function collectSeedIds(directory: string, seedFilename: string): string[] {
  const ids: string[] = [];

  function visit(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    if (
      entries.some((entry) => entry.isFile() && entry.name === seedFilename)
    ) {
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
