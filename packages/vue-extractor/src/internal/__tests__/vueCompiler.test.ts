import fs from 'node:fs';
import path from 'node:path';
import * as t from '@babel/types';
import { parse, parse as parseTemplate } from '@vue/compiler-dom';
import * as testVueCompiler from '#vue-compiler-sfc';
import { hashSource } from 'generaltranslation/id';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveVueCompilerOptions } from '../../config.js';
import type { VueCompiler, VueCompilerOptions } from '../../types.js';
import {
  ElementTypes,
  NodeTypes,
  shiftCompilerAstLocations,
} from '../compilerAst.js';
import { extractFromVueSource as extractWithExplicitCompiler } from '../extractFromVueSource.js';
import { readStaticPrimitive } from '../utils.js';
import { inspectVueCompiler, resolveVueCompiler } from '../vueCompiler.js';
import { createTestProject } from './projectTestUtils.js';
import { extractFromVueSource } from './testVueCompiler.js';

describe('consumer Vue compiler resolution', () => {
  it.each([null, 42, 'compiler', {}, { version: '3.5.40' }])(
    'fails cleanly for an invalid explicit compiler %#',
    (compiler) => {
      expect(inspectVueCompiler(compiler as unknown as VueCompiler)).toEqual({
        ok: false,
        details: expect.stringContaining('compiler'),
      });
    }
  );

  it('probes one explicit compiler only once across multiple source files', async () => {
    const compileTemplate = vi.fn(testVueCompiler.compileTemplate);
    const compiler = {
      ...testVueCompiler,
      compileTemplate,
      parseTemplate,
    } as unknown as VueCompiler;
    const source = `<script setup>import { T } from 'gt-vue';</script><template><T>Hello</T></template>`;

    const outputs = await Promise.all([
      extractWithExplicitCompiler(source, '/fixtures/First.vue', {
        compiler,
      }),
      extractWithExplicitCompiler(source, '/fixtures/Second.vue', {
        compiler,
      }),
      extractWithExplicitCompiler(source, '/fixtures/Third.vue', {
        compiler,
      }),
    ]);

    expect(outputs.every((output) => output.errors.length === 0)).toBe(true);
    expect(compileTemplate).toHaveBeenCalledTimes(1);
  });

  it('uses the Vue compiler installed beside the consuming SFC', () => {
    const file = path.resolve(
      import.meta.dirname,
      '../../../../vue/src/CompilerProbe.vue'
    );
    const resolution = resolveVueCompiler(file, path.dirname(file));

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.value.version).toMatch(/^3\.(?:[3-9]|\d{2,})\./);
    expect(resolution.value.compiler.version).toBe(resolution.value.version);
    expect(resolution.value.implicitSlotWhitespace).toBe(
      minorVersion(resolution.value.version) >= 5 ? 'html' : 'ecmascript'
    );
  });

  it('loads the consumer compiler browser distributions when Bun cannot follow the Vue proxy', () => {
    const root = createProject({ vue: '3.5.40' });
    writeBunIsolatedVuePackage(root, '3.5.40');
    Object.defineProperty(process.versions, 'bun', {
      configurable: true,
      value: '1.3.14',
    });

    try {
      const resolution = resolveVueCompiler(
        path.join(root, 'src/App.vue'),
        root
      );

      expect(resolution).toEqual({
        ok: true,
        value: expect.objectContaining({
          implicitSlotWhitespace: 'ecmascript',
          templateParseOptionsSupported: true,
          version: '3.5.40',
        }),
      });
      if (!resolution.ok) return;
      expect(resolution.value.parseTemplate?.('A &amp; B', {})).toMatchObject({
        decoded: 'A & B',
      });
      expect(
        resolution.value.templateCompiler?.compile('A&nbsp;B', {})
      ).toMatchObject({ decoded: 'A\u00a0B' });
    } finally {
      delete process.versions.bun;
    }
  });

  it('rejects unsupported consumer compiler versions through the Bun fallback', () => {
    const root = createProject({ vue: '3.2.47' });
    writeBunIsolatedVuePackage(root, '3.2.47');
    Object.defineProperty(process.versions, 'bun', {
      configurable: true,
      value: '1.3.14',
    });

    try {
      const resolution = resolveVueCompiler(
        path.join(root, 'src/App.vue'),
        root
      );

      expect(resolution).toEqual({
        ok: false,
        details:
          'Resolved Vue compiler version "3.2.47"; gt-vue supports Vue 3.3 through Vue 3.x.',
      });
    } finally {
      delete process.versions.bun;
    }
  });

  it('does not let bundled fallback hide a declared but missing Vue install', () => {
    const root = createProject({ vue: '^3.3.0' });
    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        'declares Vue "^3.3.0" but vue/compiler-sfc could not be resolved'
      ),
    });
  });

  it('does not resolve the extractor package compiler for a project without Vue', () => {
    const root = createProject({});
    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        `Could not resolve vue/compiler-sfc from ${path.join(root, 'src/App.vue')}`
      ),
    });
  });

  it('fails closed when an installed Vue package has no compiler export', () => {
    const root = createProject({ vue: '3.3.13' });
    writeVuePackage(root, {
      exports: { './package.json': './package.json' },
      version: '3.3.13',
    });

    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining("Resolved the app's Vue package"),
    });
  });

  it('fails closed when Vue and compiler-sfc versions disagree', () => {
    const root = createProject({ vue: '3.5.40' });
    writeVuePackage(root, { version: '3.5.40' }, '3.4.38');

    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        'resolves Vue 3.5.40 but vue/compiler-sfc 3.4.38'
      ),
    });
  });

  it('rejects compiler versions outside the gt-vue peer range', () => {
    const root = createProject({ vue: '4.0.0' });
    writeVuePackage(root, { version: '4.0.0' }, '4.0.0');

    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        'gt-vue supports Vue 3.3 through Vue 3.x'
      ),
    });
  });

  function createProject(dependencies: Record<string, string>): string {
    const root = createTestProject({
      'package.json': JSON.stringify({
        dependencies,
        name: 'fixture',
        private: true,
      }),
    });
    fs.mkdirSync(path.join(root, 'src'));
    return root;
  }

  function writeVuePackage(
    root: string,
    manifest: { exports?: Record<string, string>; version: string },
    compilerVersion = manifest.version
  ): void {
    const directory = path.join(root, 'node_modules/vue');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        exports: manifest.exports ?? {
          './compiler-sfc': './compiler-sfc.cjs',
          './package.json': './package.json',
        },
        name: 'vue',
        version: manifest.version,
      })
    );
    if (
      manifest.exports?.['./compiler-sfc'] === undefined &&
      manifest.exports
    ) {
      return;
    }
    fs.writeFileSync(
      path.join(directory, 'compiler-sfc.cjs'),
      `module.exports = { compileTemplate() {}, parse() {}, version: ${JSON.stringify(compilerVersion)} };\n`
    );
  }

  function writeBunIsolatedVuePackage(root: string, version: string): void {
    writeVuePackage(root, { version });
    fs.writeFileSync(
      path.join(root, 'node_modules/vue/compiler-sfc.cjs'),
      `module.exports = require('@vue/compiler-sfc');\n`
    );

    const compilerSfcRoot = path.join(root, 'node_modules/@vue/compiler-sfc');
    const compilerDomRoot = path.join(root, 'node_modules/@vue/compiler-dom');
    fs.mkdirSync(path.join(compilerSfcRoot, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(compilerDomRoot, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(compilerSfcRoot, 'package.json'),
      JSON.stringify({ name: '@vue/compiler-sfc', version })
    );
    fs.writeFileSync(
      path.join(compilerDomRoot, 'package.json'),
      JSON.stringify({ name: '@vue/compiler-dom', version })
    );
    fs.writeFileSync(
      path.join(compilerSfcRoot, 'dist/compiler-sfc.esm-browser.js'),
      `module.exports = {
  compileTemplate() {
    return {
      errors: [],
      ast: {
        children: [{
          tag: 'Probe',
          codegenNode: { children: { properties: [] } }
        }]
      }
    };
  },
  parse(_source, options) {
    return {
      descriptor: {
        template: {
          ast: {
            children: [{
              type: 2,
              content: options.templateParseOptions.whitespace
            }]
          }
        }
      }
    };
  },
  version: ${JSON.stringify(version)}
};\n`
    );
    fs.writeFileSync(
      path.join(compilerDomRoot, 'dist/compiler-dom.esm-browser.js'),
      `module.exports = {
  compile(source, options) {
    return { decoded: options.decodeEntities(source, false) };
  },
  parse(source, options) {
    return { decoded: options.decodeEntities(source, true) };
  }
};\n`
    );
  }

  function minorVersion(version: string): number {
    return Number(version.split('.')[1]);
  }
});

describe('Vue compiler option parity', () => {
  it('fails closed for custom delimiters on an explicit legacy compiler', async () => {
    const legacyCompiler = {
      ...testVueCompiler,
      parse(source: string, options: Record<string, unknown> = {}) {
        const { templateParseOptions: _ignored, ...legacyOptions } = options;
        return testVueCompiler.parse(source, legacyOptions);
      },
      parseTemplate,
      version: '3.3.13',
    } as unknown as VueCompiler;
    const source = `<script setup>import { T } from 'gt-vue';</script><template><T>[[ '</template>' ]] after</T></template>`;

    const output = await extractFromVueSource(
      source,
      '/fixtures/explicit-legacy-delimiters.vue',
      {
        compiler: legacyCompiler,
        compilerOptions: { delimiters: ['[[', ']]'] },
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not safely apply custom Vue template delimiters'
    );
  });

  it('recovers v-for scopes when compiler metadata is absent', async () => {
    const compiler = {
      ...testVueCompiler,
      parseTemplate: parseTemplateWithoutForMetadata,
    } as unknown as VueCompiler;
    const source = `<script setup>import { Fragment as F } from 'vue'; import { T } from 'gt-vue'; const choices = [String];</script><template><div v-for="F in choices"><T><component :is="F"><span>Opaque child</span></component><b>After</b></T></div></template>`;

    const output = await extractFromVueSource(
      source,
      '/fixtures/vue-3.3-v-for.vue',
      { compiler }
    );

    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain(
      'Found a dynamic <component> inside a gt-vue <T> component'
    );
    expect(output.results).toEqual([]);
  });

  it('recovers v-for sources, defaults, and iterators without metadata', async () => {
    const compiler = {
      ...testVueCompiler,
      parseTemplate: parseTemplateWithoutForMetadata,
    } as unknown as VueCompiler;
    const source = `<script setup>import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [];</script><template><div v-for="{ value = gt('VFor default') } in gt('VFor source')" :title="value" /><div v-for="(value, gt, index) in rows" :title="gt('Shadowed iterator')" /></template>`;

    const output = await extractFromVueSource(
      source,
      '/fixtures/vue-3.3-v-for-expressions.vue',
      { compiler }
    );

    expect(output.errors).toEqual([]);
    expect(
      output.results
        .filter((result) => result.dataFormat === 'STRING')
        .map((result) => result.source)
    ).toEqual(['VFor default', 'VFor source']);
  });

  it('uses custom delimiters while locating the SFC template boundary', async () => {
    const source = `<script setup>import { T } from 'gt-vue';</script><template><T>[[ '</template>' ]] after</T></template>`;
    const custom = await extractFromVueSource(
      source,
      '/fixtures/structural-delimiters.vue',
      {
        compilerOptions: { delimiters: ['[[', ']]'] },
        projectRoot: '/fixtures',
      }
    );

    expect(custom.errors).toEqual([]);
    expect(custom.results.map(({ source }) => source)).toEqual([
      '</template> after',
    ]);
  });

  it('changes extracted rich content when Vue preserves whitespace', async () => {
    const source = `
      <script setup>
      import { T } from 'gt-vue';
      </script>
      <template>
        <T>First
          second</T>
      </template>
    `;

    const condensed = await extractFromVueSource(source, 'Component.vue', {
      compilerOptions: { whitespace: 'condense' },
    });
    const preserved = await extractFromVueSource(source, 'Component.vue', {
      compilerOptions: { whitespace: 'preserve' },
    });

    expect(condensed.errors).toEqual([]);
    expect(preserved.errors).toEqual([]);
    expect(condensed.results).toHaveLength(1);
    expect(preserved.results).toHaveLength(1);
    expect(preserved.results[0].source).not.toEqual(
      condensed.results[0].source
    );
    expect(hashFor(preserved.results[0])).not.toBe(
      hashFor(condensed.results[0])
    );
  });

  it('uses the application interpolation delimiters', async () => {
    const source = `
      <script setup>
      import { T, Var } from 'gt-vue';
      const name = 'Ada';
      </script>
      <template><T>Hello <Var>[[ name ]]</Var></T></template>
    `;

    const result = await extractFromVueSource(source, 'Component.vue', {
      compilerOptions: { delimiters: ['[[', ']]'] },
    });

    expect(result.errors).toEqual([]);
    expect(result.results).toEqual([
      expect.objectContaining({
        dataFormat: 'JSX',
        source: ['Hello ', { i: 1, k: '_gt_value_1', v: 'v' }],
      }),
    ]);
  });

  it.each(['condense', 'preserve'] as const)(
    'rejects comment-driven %s whitespace that changes in production',
    async (whitespace) => {
      const source = `
        <script setup>import { T } from 'gt-vue';</script>
        <template>
          <T><i>First</i> <!-- separator --> <b>Second</b></T>
          <T><p><i>Nested</i> <!-- separator --> <b>content</b></p></T>
        </template>
      `;

      const result = await extractFromVueSource(source, 'Component.vue', {
        compilerOptions: { whitespace },
      });

      expect(result.results).toEqual([]);
      expect(result.errors.join('\n')).toContain(
        'comment adjacent to translatable whitespace'
      );
    }
  );

  it.each(['condense', 'preserve'] as const)(
    'rejects whitespace-free comment boundaries with %s whitespace',
    async (whitespace) => {
      const source = `
        <script setup>import { T } from 'gt-vue';</script>
        <template><T>Hello<!-- translator note -->world</T></template>
      `;

      const result = await extractFromVueSource(source, 'Component.vue', {
        compilerOptions: { whitespace },
      });

      expect(result.results).toEqual([]);
      expect(result.errors.join('\n')).toContain(
        'hash changes between development and production'
      );
    }
  );

  function hashFor(
    result: Awaited<ReturnType<typeof extractFromVueSource>>['results'][number]
  ) {
    return hashSource({
      dataFormat: result.dataFormat,
      source: result.source,
      ...(result.metadata.context && { context: result.metadata.context }),
    });
  }

  /** Simulates Vue 3.3's compiler AST without installing a second Vue copy. */
  function parseTemplateWithoutForMetadata(
    ...args: Parameters<typeof parseTemplate>
  ): ReturnType<typeof parseTemplate> {
    const ast = parseTemplate(...args);
    removeForParseResults(ast);
    return ast;
  }

  /** Removes only the normalized field that Vue added after the 3.3 line. */
  function removeForParseResults(value: unknown, seen = new WeakSet<object>()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if ('forParseResult' in value) delete value.forParseResult;
    for (const child of Object.values(value)) {
      removeForParseResults(child, seen);
    }
  }
});

describe('local Vue compiler AST discriminants', () => {
  it('matches the installed Vue compiler', () => {
    const root = parse(
      '<Probe plain v-bind:title="title">text<!--comment-->{{ value }}</Probe>'
    );
    const element = root.children[0];
    const slot = parse('<slot />').children[0];
    if (element?.type !== 1 || slot?.type !== 1) {
      throw new Error('Vue returned an unknown element AST shape');
    }
    const text = element.children.find((child) => child.type === 2);
    const comment = element.children.find((child) => child.type === 3);
    const interpolation = element.children.find((child) => child.type === 5);
    const attribute = element.props.find((property) => property.type === 6);
    const directive = element.props.find((property) => property.type === 7);
    if (!text || !comment || !interpolation || !attribute || !directive) {
      throw new Error('Vue returned an incomplete compiler AST probe');
    }

    expect(NodeTypes).toEqual({
      ELEMENT: element.type,
      TEXT: text.type,
      COMMENT: comment.type,
      SIMPLE_EXPRESSION: interpolation.content.type,
      INTERPOLATION: interpolation.type,
      ATTRIBUTE: attribute.type,
      DIRECTIVE: directive.type,
    });
    expect(ElementTypes).toEqual({
      COMPONENT: element.tagType,
      SLOT: slot.tagType,
    });
  });

  it('rebases shared compiler positions only once across nested locations', () => {
    const sharedStart = { column: 2, line: 1, offset: 1 };
    const sharedEnd = { column: 4, line: 2, offset: 8 };
    const ast = {
      children: [
        {
          loc: { end: sharedEnd, source: 'outer', start: sharedStart },
          nested: {
            loc: { end: sharedEnd, source: 'inner', start: sharedStart },
          },
        },
      ],
      loc: {
        end: { column: 1, line: 3, offset: 9 },
        source: 'root',
        start: { column: 1, line: 1, offset: 0 },
      },
    };

    shiftCompilerAstLocations(ast, { column: 7, line: 5, offset: 100 });

    expect(sharedStart).toEqual({ column: 8, line: 5, offset: 101 });
    expect(sharedEnd).toEqual({ column: 4, line: 6, offset: 108 });
  });
});

describe('readStaticPrimitive template literals', () => {
  it('uses cooked runtime text for every quasi', () => {
    const template = t.templateLiteral(
      [
        t.templateElement({ cooked: 'first\n', raw: 'first\\n' }),
        t.templateElement({ cooked: '\tlast', raw: '\\tlast' }, true),
      ],
      [t.stringLiteral('middle')]
    );

    expect(readStaticPrimitive(template)).toEqual({
      ok: true,
      value: 'first\nmiddle\tlast',
    });
  });

  it.each(['first', 'later'] as const)(
    'fails closed when the %s quasi has no cooked runtime value',
    (missingQuasi) => {
      const template = t.templateLiteral(
        [
          t.templateElement({ cooked: 'first', raw: 'first' }),
          t.templateElement({ cooked: 'last', raw: 'last' }, true),
        ],
        [t.stringLiteral('middle')]
      );
      template.quasis[missingQuasi === 'first' ? 0 : 1].value.cooked = null;

      expect(readStaticPrimitive(template)).toEqual({ ok: false });
    }
  );
});

describe('resolveVueCompilerOptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses explicit options when no framework config exists', () => {
    const root = createTestProject({});

    expect(
      resolveVueCompilerOptions(root, {
        delimiters: ['[[', ']]'],
        whitespace: 'condense',
      })
    ).toEqual({
      compilerOptions: {
        delimiters: ['[[', ']]'],
        whitespace: 'condense',
      },
      errors: [],
    });
  });

  it('resolves static Vite options through aliases, spreads, and TypeScript wrappers', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        const delimiters = ['[[', ']]'] as const;
        const compilerOptions = {
          whitespace: 'preserve',
          delimiters,
        } satisfies Record<string, unknown>;
        const template = { compilerOptions: { ...compilerOptions } };
        export default { plugins: [vue({ template })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {
        delimiters: ['[[', ']]'],
        whitespace: 'preserve',
      },
      errors: [],
    });
  });

  it('accepts Vue JSX options that do not affect supported source hashes', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import vueJsx from '@vitejs/plugin-vue-jsx';
        const plugin = vueJsx;
        export default { plugins: [plugin({
          babelPlugins: [],
          defineComponentName: ['defineComponent'],
          enableObjectSlots: true,
          mergeProps: true,
          optimize: true,
          pragma: '',
          resolveType: false,
          transformOn: false,
          tsPluginOptions: {},
        })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it.each([
    {
      name: 'a replacement VNode pragma',
      options: `pragma: 'customVNode'`,
      diagnostic: 'option "pragma"',
    },
    {
      name: 'custom Babel transforms',
      options: `babelPlugins: [customPlugin]`,
      diagnostic: 'option "babelPlugins"',
    },
    {
      name: 'a custom include filter',
      options: `include: /src/`,
      diagnostic: 'option "include"',
    },
    {
      name: 'a custom exclude filter',
      options: `exclude: /generated/`,
      diagnostic: 'option "exclude"',
    },
    {
      name: 'custom TypeScript transforms',
      options: `tsPluginOptions: { optimizeConstEnums: true }`,
      diagnostic: 'option "tsPluginOptions"',
    },
    {
      name: 'custom-element classification',
      options: `isCustomElement: (tag) => tag.startsWith('x-')`,
      diagnostic: 'option "isCustomElement"',
    },
    {
      name: 'disabled object-slot normalization',
      options: `enableObjectSlots: false`,
      diagnostic: 'option "enableObjectSlots"',
    },
    {
      name: 'disabled prop merging',
      options: `mergeProps: false`,
      diagnostic: 'option "mergeProps"',
    },
    {
      name: 'listener-object transformation',
      options: `transformOn: true`,
      diagnostic: 'option "transformOn"',
    },
    {
      name: 'runtime type inference',
      options: `resolveType: true`,
      diagnostic: 'option "resolveType"',
    },
    {
      name: 'custom component factory names',
      options: `defineComponentName: ['component']`,
      diagnostic: 'option "defineComponentName"',
    },
    {
      name: 'a future unknown option',
      options: `futureVNodeMode: true`,
      diagnostic: 'option "futureVNodeMode"',
    },
    {
      name: 'a dynamic optimization option',
      options: `optimize: process.env.OPTIMIZE === '1'`,
      diagnostic: 'option "optimize"',
    },
  ])(
    'fails closed for $name in the Vue JSX plugin',
    ({ options, diagnostic }) => {
      const root = createTestProject({
        'vite.config.ts': `
        import * as pluginVueJsx from '@vitejs/plugin-vue-jsx';
        const customPlugin = () => ({ visitor: {} });
        const jsx = pluginVueJsx.default;
        export default { plugins: [jsx({ ${options} })] };
      `,
      });

      const result = resolveVueCompilerOptions(root, undefined);

      expect(result.compilerOptions).toEqual({});
      expect(result.errors.join('\n')).toContain(diagnostic);
    }
  );

  it('fails closed when active Vue JSX plugin options are dynamic', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import vueJsx from '@vitejs/plugin-vue-jsx';
        const options = getOptions();
        export default { plugins: [vueJsx(options)] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve @vitejs/plugin-vue-jsx options'
    );
  });

  it('tracks CommonJS Vue JSX plugin imports before auditing options', () => {
    const root = createTestProject({
      'vite.config.cjs': `
        const vueJsx = require('@vitejs/plugin-vue-jsx').default;
        module.exports = { plugins: [vueJsx({ mergeProps: false })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain('option "mergeProps"');
  });

  it('resolves static Nuxt compiler options', () => {
    const root = createTestProject({
      'nuxt.config.ts': `
        const whitespace = \`preserve\`;
        const delimiters = ['<%', '%>'] as const;
        export default defineNuxtConfig({
          vue: { compilerOptions: { whitespace, delimiters } },
        });
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {
        delimiters: ['<%', '%>'],
        whitespace: 'preserve',
      },
      errors: [],
    });
  });

  it('fails closed when Nuxt layers can contribute compiler options', () => {
    const root = createTestProject({
      'nuxt.config.ts': `
        export default defineNuxtConfig({ extends: ['./layers/base'] });
      `,
      'layers/base/nuxt.config.ts': `
        export default defineNuxtConfig({
          vue: { compilerOptions: { delimiters: ['[[', ']]'] } },
        });
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain('Nuxt layer inheritance');
  });

  it.each([
    {
      name: 'a custom srcDir',
      config: `export default defineNuxtConfig({ srcDir: 'client/' });`,
    },
    {
      name: 'custom directory overrides',
      config: `export default defineNuxtConfig({ dir: { pages: 'screens' } });`,
    },
  ])(
    'fails closed for $name that default discovery cannot scan',
    ({ config }) => {
      const root = createTestProject({ 'nuxt.config.ts': config });

      const result = resolveVueCompilerOptions(root, undefined);

      expect(result.compilerOptions).toEqual({});
      expect(result.errors.join('\n')).toContain(
        'custom Nuxt source directories'
      );
    }
  );

  it.each(['.', './', 'app/', 'src/'])(
    'accepts the covered Nuxt srcDir %s',
    (srcDir) => {
      const root = createTestProject({
        'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: ${JSON.stringify(srcDir)} });`,
      });

      expect(resolveVueCompilerOptions(root, undefined)).toEqual({
        compilerOptions: {},
        errors: [],
      });
    }
  );

  it.each<{
    name: string;
    file: string;
    source: string;
    expected: VueCompilerOptions;
    diagnostic?: string;
  }>([
    {
      name: 'Vite plugin namespace import',
      file: 'vite.config.mjs',
      source: `import * as pluginVue from '@vitejs/plugin-vue'; export default { plugins: [pluginVue.default({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite CJS default member',
      file: 'vite.config.cjs',
      source: `const vue = require('@vitejs/plugin-vue').default; module.exports = { plugins: [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`,
      expected: { delimiters: ['[[', ']]'] },
    },
    {
      name: 'Nuxt plain default-exported object',
      file: 'nuxt.config.js',
      source: `export default { vue: { compilerOptions: { whitespace: 'preserve' } } };`,
      expected: { whitespace: 'preserve' },
    },

    {
      name: 'Vite immutable plugin alias',
      file: 'vite.config.ts',
      source: `import vue from '@vitejs/plugin-vue'; const plugin = vue; export default { plugins: [plugin({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite deep plugin alias',
      file: 'vite.config.ts',
      source: `import vue from '@vitejs/plugin-vue'; const first = vue; const second = first; export default { plugins: [second({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`,
      expected: { delimiters: ['[[', ']]'] },
    },
    {
      name: 'Vite CJS destructured default',
      file: 'vite.config.cjs',
      source: `const { default: vue } = require('@vitejs/plugin-vue'); module.exports = { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite TS import-equals namespace',
      file: 'vite.config.cts',
      source: `import pluginVue = require('@vitejs/plugin-vue'); export default { plugins: [pluginVue.default({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite optional plugin call',
      file: 'vite.config.ts',
      source: `import vue from '@vitejs/plugin-vue'; export default { plugins: [vue?.({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite namespace default alias',
      file: 'vite.config.mjs',
      source: `import * as pluginVue from '@vitejs/plugin-vue'; const vue = pluginVue.default; export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite computed namespace default',
      file: 'vite.config.mjs',
      source: `import * as pluginVue from '@vitejs/plugin-vue'; export default { plugins: [pluginVue['default']({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite optional namespace default',
      file: 'vite.config.mjs',
      source: `import * as pluginVue from '@vitejs/plugin-vue'; export default { plugins: [pluginVue?.default({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite optional computed namespace default and call',
      file: 'vite.config.mjs',
      source: `import * as pluginVue from '@vitejs/plugin-vue'; export default { plugins: [pluginVue?.['default']?.({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`,
      expected: { delimiters: ['[[', ']]'] },
    },
    {
      name: 'Vite computed CJS namespace default',
      file: 'vite.config.cjs',
      source: `const vue = require('@vitejs/plugin-vue')['default']; module.exports = { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite computed TS import-equals default',
      file: 'vite.config.cts',
      source: `import pluginVue = require('@vitejs/plugin-vue'); export default { plugins: [pluginVue['default']({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Vite mutated plugin alias fails closed',
      file: 'vite.config.ts',
      source: `import vue from '@vitejs/plugin-vue'; const other = vue; let plugin = vue; plugin = other; export default { plugins: [plugin({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: {},
      diagnostic: 'Could not statically resolve Vue compiler options',
    },
    {
      name: 'unrelated Vite function is ignored',
      file: 'vite.config.ts',
      source: `const plugin = (value) => value; export default { plugins: [plugin({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
      expected: {},
    },
    {
      name: 'Nuxt imported helper alias',
      file: 'nuxt.config.ts',
      source: `import { defineNuxtConfig as define } from 'nuxt/config'; export default define({ vue: { compilerOptions: { whitespace: 'preserve' } } });`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Nuxt immutable helper alias chain',
      file: 'nuxt.config.ts',
      source: `import { defineNuxtConfig } from 'nuxt/config'; const first = defineNuxtConfig; const define = first; export default define({ vue: { compilerOptions: { delimiters: ['[[', ']]'] } } });`,
      expected: { delimiters: ['[[', ']]'] },
    },
    {
      name: 'Nuxt module.exports object',
      file: 'nuxt.config.cjs',
      source: `module.exports = { vue: { compilerOptions: { whitespace: 'preserve' } } };`,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'Nuxt exports.default object',
      file: 'nuxt.config.cjs',
      source: `exports.default = { vue: { compilerOptions: { delimiters: ['[[', ']]'] } } };`,
      expected: { delimiters: ['[[', ']]'] },
    },
    {
      name: 'Nuxt mutated helper alias fails closed',
      file: 'nuxt.config.ts',
      source: `import { defineNuxtConfig } from 'nuxt/config'; let define = defineNuxtConfig; define = (value) => value; export default define({ vue: { compilerOptions: { whitespace: 'preserve' } } });`,
      expected: {},
      diagnostic: 'Could not statically resolve Vue compiler options',
    },
  ])('plugin and helper references: $name', (testCase) => {
    const root = createTestProject({ [testCase.file]: testCase.source });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual(testCase.expected);
    if (testCase.diagnostic) {
      expect(result.errors.join('\n')).toContain(testCase.diagnostic);
    } else {
      expect(result.errors).toEqual([]);
    }
  });

  it('combines matching explicit and project options', () => {
    const root = createTestProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        })] };
      `,
    });

    expect(
      resolveVueCompilerOptions(root, {
        delimiters: ['[[', ']]'],
        whitespace: 'preserve',
      })
    ).toEqual({
      compilerOptions: {
        delimiters: ['[[', ']]'],
        whitespace: 'preserve',
      },
      errors: [],
    });
  });

  it('fails closed when explicit and project options conflict', () => {
    const root = createTestProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({
          template: { compilerOptions: { whitespace: 'condense' } },
        })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, {
      whitespace: 'preserve',
    });

    expect(result.compilerOptions).toEqual({ whitespace: 'preserve' });
    expect(result.errors.join('\n')).toContain(
      'conflicting Vue whitespace compiler options'
    );
  });

  it('fails closed for dynamic hash-affecting options', () => {
    const root = createTestProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        const compilerOptions = getCompilerOptions();
        export default { plugins: [vue({ template: { compilerOptions } })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('fails closed for a dynamic compiler-options parent', () => {
    const root = createTestProject({
      'nuxt.config.ts': `
        const vue = getVueOptions();
        export default defineNuxtConfig({ vue });
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it.each([
    'nodeTransforms',
    'directiveTransforms',
    'isCustomElement',
    'getNamespace',
    'getTextMode',
    'decodeEntities',
    'comments',
    'prefixIdentifiers',
    'hoistStatic',
    'cacheHandlers',
    'scopeId',
  ])('fails closed for the Vite compiler option %s', (option) => {
    const root = createTestProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: {
          whitespace: 'preserve',
          ${option}: true,
        } } })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({ whitespace: 'preserve' });
    expect(result.errors.join('\n')).toContain(
      `unsupported Vue compiler option "${option}"`
    );
  });

  it.each(['nodeTransforms', 'directiveTransforms', 'isCustomElement'])(
    'fails closed for the Nuxt compiler option %s',
    (option) => {
      const root = createTestProject({
        'nuxt.config.ts': `
          export default defineNuxtConfig({ vue: { compilerOptions: {
            delimiters: ['[[', ']]'],
            ${option}: true,
          } } });
        `,
      });

      const result = resolveVueCompilerOptions(root, undefined);

      expect(result.compilerOptions).toEqual({ delimiters: ['[[', ']]'] });
      expect(result.errors.join('\n')).toContain(
        `unsupported Vue compiler option "${option}"`
      );
    }
  );

  it('fails closed for a custom Vite compiler-sfc instance', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        import * as compiler from './custom-compiler';
        export default { plugins: [vue({ compiler })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain('custom Vue compiler instance');
  });

  it('reports syntax errors only when a config references compiler options', () => {
    const relevantRoot = createTestProject({
      'vite.config.ts': `const compilerOptions = { whitespace: ;`,
    });
    const unrelatedRoot = createTestProject({
      'vite.config.ts': `const unrelated = { broken: ;`,
    });

    expect(
      resolveVueCompilerOptions(relevantRoot, undefined).errors.join('\n')
    ).toContain('Could not parse a project configuration');
    expect(resolveVueCompilerOptions(unrelatedRoot, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('reports every malformed explicit Vite config', () => {
    const root = createTestProject({
      'config/custom.ts': `const unrelated = { broken: ;`,
    });

    const result = resolveVueCompilerOptions(root, undefined, {
      viteConfigPath: 'config/custom.ts',
    });

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not parse the Vue project config file'
    );
  });

  it('reports malformed project config when source discovery is explicit', () => {
    const root = createTestProject({
      'nuxt.config.ts': `const unrelated = { broken: ;`,
    });

    const result = resolveVueCompilerOptions(root, undefined, {
      sourceDiscoveryIsExplicit: true,
    });

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not parse the Vue project config file'
    );
  });

  it('lets explicit source discovery bypass only Nuxt layout validation', () => {
    const root = createTestProject({
      'nuxt.config.ts': `
        export default defineNuxtConfig({
          srcDir: 'custom-app',
          vue: { compilerOptions: { whitespace: 'preserve' } },
        });
      `,
    });

    expect(
      resolveVueCompilerOptions(root, undefined, {
        sourceDiscoveryIsExplicit: true,
      })
    ).toEqual({
      compilerOptions: { whitespace: 'preserve' },
      errors: [],
    });
  });

  it('rejects cross-framework config ambiguity even when options match', () => {
    const root = createTestProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: {
          whitespace: 'preserve',
        } } })] };
      `,
      'nuxt.config.ts': `
        export default defineNuxtConfig({
          vue: { compilerOptions: { whitespace: 'preserve' } },
        });
      `,
    });

    const result = resolveVueCompilerOptions(root, {
      whitespace: 'preserve',
    });

    expect(result.compilerOptions).toEqual({ whitespace: 'preserve' });
    expect(result.errors.join('\n')).toContain(
      'Found both Nuxt and Vite project config files'
    );
  });

  it('rejects malformed explicit options at runtime', () => {
    const root = createTestProject({});

    const invalidWhitespace = resolveVueCompilerOptions(root, {
      whitespace: 'collapse',
    } as never);
    const invalidDelimiters = resolveVueCompilerOptions(root, {
      delimiters: ['[[', ''],
    });

    expect(invalidWhitespace.errors.join('\n')).toContain(
      'invalid Vue whitespace compiler option'
    );
    expect(invalidDelimiters.errors.join('\n')).toContain(
      'invalid Vue interpolation delimiters'
    );
  });

  it('ignores unrelated dynamic plugin options', () => {
    const root = createTestProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ script: getScriptOptions() })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it.each([
    {
      name: 'dead Vue plugin calls',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        const unused = vue({ template: { compilerOptions: { whitespace: 'preserve' } } });
        export default defineConfig({ plugins: [vue()] });
      `,
      expected: {},
    },
    {
      name: 'a defineConfig function return',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        export default defineConfig(() => ({ plugins: [vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        })] }));
      `,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'an immutable config alias and plugin-array spreads',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        const gtPlugins = [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })];
        const plugins = [...gtPlugins];
        const shared = { plugins };
        const config = { ...shared };
        const wrap = defineConfig;
        export default wrap(config);
      `,
      expected: { delimiters: ['[[', ']]'] },
    },
    {
      name: 'a statically selected plugin branch',
      source: `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [true ? vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        }) : vue()] };
      `,
      expected: { whitespace: 'preserve' },
    },
  ])(
    'resolves only the active Vite graph through $name',
    ({ source, expected }) => {
      const root = createTestProject({ 'vite.config.ts': source });

      expect(resolveVueCompilerOptions(root, undefined)).toEqual({
        compilerOptions: expected,
        errors: [],
      });
    }
  );

  it.each([
    {
      name: 'a dynamic plugin branch',
      source: `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [flag ? vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        }) : vue()] };
      `,
    },
    {
      name: 'a wrapper that returns the Vue plugin',
      source: `
        import vue from '@vitejs/plugin-vue';
        const makeVue = () => vue({ template: { compilerOptions: { whitespace: 'preserve' } } });
        export default { plugins: [makeVue()] };
      `,
    },
    {
      name: 'multiple active Vue plugin instances',
      source: `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue(), vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        })] };
      `,
    },
    {
      name: 'a config function with multiple possible returns',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        export default defineConfig((env) => {
          if (env.command === 'build') return { plugins: [vue()] };
          return { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
        });
      `,
    },
    {
      name: 'a mutated defineConfig alias',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        let wrap = defineConfig;
        wrap = (value) => value;
        export default wrap({ plugins: [vue()] });
      `,
    },
  ])('fails closed for $name', ({ source }) => {
    const root = createTestProject({ 'vite.config.ts': source });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it.each([
    {
      name: 'nested plugin options mutated by assignment',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        options.template.compilerOptions.whitespace = 'preserve';
        export default { plugins: [vue(options)] };
      `,
    },
    {
      name: 'an active plugin array mutated with push',
      source: `
        import vue from '@vitejs/plugin-vue';
        const plugins = [];
        plugins.push(vue({ template: { compilerOptions: { whitespace: 'preserve' } } }));
        export default { plugins };
      `,
    },
    {
      name: 'an aliased config object mutated by assignment',
      source: `
        import vue from '@vitejs/plugin-vue';
        const config = { plugins: [vue()] };
        const alias = config;
        alias.plugins = [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })];
        export default config;
      `,
    },
    {
      name: 'a compiler options object mutated with Object.assign',
      source: `
        import vue from '@vitejs/plugin-vue';
        const compilerOptions = { whitespace: 'condense' };
        Object.assign(compilerOptions, { whitespace: 'preserve' });
        export default { plugins: [vue({ template: { compilerOptions } })] };
      `,
    },
    {
      name: 'plugin options escape to an unknown mutator call',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        mutate(options);
        export default { plugins: [vue(options)] };
      `,
    },
    {
      name: 'an assignment alias mutates plugin options',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        let alias;
        alias = options;
        alias.template.compilerOptions.whitespace = 'preserve';
        export default { plugins: [vue(options)] };
      `,
    },
    {
      name: 'a destructured alias mutates plugin options',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        const { template } = options;
        template.compilerOptions.whitespace = 'preserve';
        export default { plugins: [vue(options)] };
      `,
    },
  ])('fails closed when $name', ({ source }) => {
    const root = createTestProject({ 'vite.config.ts': source });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('uses only Vite’s first standard config file', () => {
    const root = createTestProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue()] };
      `,
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('uses Vite’s mjs config before its TypeScript config', () => {
    const root = createTestProject({
      'vite.config.mjs': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue()] };
      `,
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('does not fall through when Vite’s first config candidate is a directory', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });
    fs.mkdirSync(path.join(root, 'vite.config.js'));

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain('not a regular file');
  });

  it('does not auto-discover JSX or TSX Vite config names', () => {
    const root = createTestProject({
      'vite.config.tsx': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('uses the last direct CommonJS overwrite and ignores the earlier value', () => {
    const root = createTestProject({
      'vite.config.cjs': `
        const vue = require('@vitejs/plugin-vue').default;
        module.exports = { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
        module.exports = { plugins: [vue()] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('ignores dead Nuxt helper calls and reads only the exported config', () => {
    const root = createTestProject({
      'nuxt.config.ts': `
        const unused = defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'preserve' } } });
        export default defineNuxtConfig({});
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('uses only Nuxt’s first standard config file', () => {
    const root = createTestProject({
      'nuxt.config.js': `export default { vue: { compilerOptions: { whitespace: 'condense' } } };`,
      'nuxt.config.ts': `export default defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'preserve' } } });`,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { whitespace: 'condense' },
      errors: [],
    });
  });

  it('uses Nuxt’s TypeScript config before its mjs config', () => {
    const root = createTestProject({
      'nuxt.config.mjs': `export default { vue: { compilerOptions: { whitespace: 'preserve' } } };`,
      'nuxt.config.ts': `export default defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'condense' } } });`,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { whitespace: 'condense' },
      errors: [],
    });
  });

  it('fails closed when both standard Nuxt and Vite configs exist', () => {
    const root = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'condense' } } });`,
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Found both Nuxt and Vite project config files'
    );
  });

  it('keeps framework-config ambiguity fatal with explicit source patterns', () => {
    const root = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({});`,
      'vite.config.ts': `export default {};`,
    });

    const result = resolveVueCompilerOptions(root, undefined, {
      sourceDiscoveryIsExplicit: true,
    });

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Found both Nuxt and Vite project config files'
    );
  });

  it('uses the last direct Nuxt CommonJS overwrite', () => {
    const root = createTestProject({
      'nuxt.config.cjs': `
        module.exports = { vue: { compilerOptions: { whitespace: 'preserve' } } };
        module.exports = { vue: { compilerOptions: { whitespace: 'condense' } } };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { whitespace: 'condense' },
      errors: [],
    });
  });

  it('fails closed for mixed CommonJS export targets', () => {
    const root = createTestProject({
      'nuxt.config.cjs': `
        module.exports = { vue: { compilerOptions: { whitespace: 'preserve' } } };
        exports.default = { vue: { compilerOptions: { whitespace: 'condense' } } };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('uses one explicit in-root Vite config and bypasses standard discovery', () => {
    const root = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'condense' } } });`,
      'config/custom.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(
      resolveVueCompilerOptions(root, undefined, {
        viteConfigPath: 'config/custom.ts',
      })
    ).toEqual({
      compilerOptions: { whitespace: 'preserve' },
      errors: [],
    });
  });

  it.each([
    ['a missing file', 'missing.ts', 'Could not find'],
    ['an outside-root file', '../outside.ts', 'outside the project'],
    [
      'a node_modules file',
      'node_modules/vite.config.ts',
      'outside the project',
    ],
    ['an unsupported file', 'vite.config.json', 'unsupported Vite config'],
  ])(
    'rejects %s as an explicit Vite config',
    (_name, viteConfigPath, error) => {
      const root = createTestProject({
        'node_modules/vite.config.ts': 'export default {};',
        'vite.config.json': '{}',
      });

      const result = resolveVueCompilerOptions(root, undefined, {
        viteConfigPath,
      });

      expect(result.compilerOptions).toEqual({});
      expect(result.errors.join('\n')).toContain(error);
    }
  );

  it('rejects an explicit Vite config path that names a directory', () => {
    const root = createTestProject({});
    fs.mkdirSync(path.join(root, 'config.ts'));

    const result = resolveVueCompilerOptions(root, undefined, {
      viteConfigPath: 'config.ts',
    });

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain('not a regular file');
  });

  it('reports an unreadable explicit Vite config without throwing', () => {
    const root = createTestProject({ 'vite.config.ts': 'export default {};' });
    const error = Object.assign(new Error('permission denied'), {
      code: 'EACCES',
    });
    vi.spyOn(fs, 'accessSync').mockImplementationOnce(() => {
      throw error;
    });

    const result = resolveVueCompilerOptions(root, undefined, {
      viteConfigPath: 'vite.config.ts',
    });

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not read the Vue project config file'
    );
    expect(result.errors.join('\n')).toContain('permission denied');
  });

  it('reports a standard config removed after discovery', () => {
    const root = createTestProject({ 'vite.config.ts': 'export default {};' });
    const error = Object.assign(new Error('config disappeared'), {
      code: 'ENOENT',
    });
    vi.spyOn(fs, 'accessSync').mockImplementationOnce(() => {
      throw error;
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not read the Vue project config file'
    );
    expect(result.errors.join('\n')).toContain('config disappeared');
  });

  it('reports a config removed between inspection and reading', () => {
    const root = createTestProject({ 'vite.config.ts': 'export default {};' });
    const error = Object.assign(new Error('file vanished'), { code: 'ENOENT' });
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw error;
    });

    const result = resolveVueCompilerOptions(root, undefined, {
      viteConfigPath: 'vite.config.ts',
    });

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not read the Vue project config file'
    );
    expect(result.errors.join('\n')).toContain('file vanished');
  });

  it('conflict-checks explicit options against a custom Vite config', () => {
    const root = createTestProject({
      'custom.mts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    const result = resolveVueCompilerOptions(
      root,
      { whitespace: 'condense' },
      { viteConfigPath: 'custom.mts' }
    );

    expect(result.compilerOptions).toEqual({ whitespace: 'condense' });
    expect(result.errors.join('\n')).toContain(
      'conflicting Vue whitespace compiler options'
    );
  });
});
