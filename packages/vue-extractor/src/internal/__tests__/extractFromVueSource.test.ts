import fs from 'node:fs';
import path from 'node:path';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueProject } from '../../project.js';
import type { VueCompilerOptions, VueExtractionResult } from '../../types.js';
import { createTestProject, linkInstalledVue } from './projectTestUtils.js';
import { extractFromVueSource } from './testVueCompiler.js';

describe('extractFromVueSource', () => {
  it('extracts context-only strings and a runtime-compatible rich source tree', async () => {
    const result = await extractFixtures(['rich.vue'], {
      includeSourceCodeContext: true,
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.updates).toHaveLength(10);

    const expectedRichSource: JsxChildren = [
      {
        t: 'p',
        i: 1,
        d: { ti: 'Greeting' },
        c: [' Hello ', { i: 2, k: '_gt_value_2', v: 'v' }, ' ! '],
      },
      {
        t: 'Plural',
        i: 3,
        d: {
          b: {
            one: [' one ', { i: 4, k: '_gt_value_4', v: 'v' }],
            other: [' other ', { i: 4, k: '_gt_value_4', v: 'v' }],
          },
          t: 'p',
        },
        c: [' fallback ', { i: 4, k: '_gt_value_4', v: 'v' }],
      },
      {
        t: 'Branch',
        i: 5,
        d: {
          b: {
            formal: [' formal ', { i: 6, k: '_gt_value_6', v: 'v' }],
            casual: [' casual ', { i: 6, k: '_gt_value_6', v: 'v' }],
          },
          t: 'b',
        },
        c: [' fallback ', { i: 6, k: '_gt_value_6', v: 'v' }],
      },
      { t: 'b', i: 7, c: 'end' },
      { i: 8, k: '_gt_n_8', v: 'n' },
      { i: 9, k: '_gt_date_9', v: 'd' },
      { i: 10, k: '_gt_cost_10', v: 'c' },
      { t: 'var', i: 11, c: 'native' },
    ];
    const rich = result.updates.find((update) => update.dataFormat === 'JSX');
    expect(rich).toMatchObject({
      dataFormat: 'JSX',
      metadata: { context: 'hero' },
      source: expectedRichSource,
    });

    const stringUpdates = result.updates.filter(
      (update) => update.dataFormat === 'STRING'
    );
    expect(stringUpdates.map((update) => update.source)).toEqual([
      'Normal {literal}',
      'Hello {name}',
      'Navigation',
      'First',
      'Second',
      'Aliased call',
      'Template call',
      'Encoded message',
      'Template title',
    ]);
    expect(
      stringUpdates.find((update) => update.source === 'Normal {literal}')
        ?.metadata
    ).toMatchObject({ context: 'normal' });
    expect(
      stringUpdates.find((update) => update.source === 'First')?.metadata
    ).toMatchObject({ context: 'list' });
    expect(
      stringUpdates.find((update) => update.source === 'Template call')
        ?.metadata
    ).toMatchObject({ context: 'template' });
    expect(
      stringUpdates.find((update) => update.source === 'Normal {literal}')
        ?.metadata.sourceCode
    ).toBeDefined();
  });

  it('rejects comments that make whitespace hashes build-dependent', async () => {
    const result = await extractFixtures(['comments.vue']);

    expect(result.updates).toEqual([]);
    expect(result.errors.join('\n')).toContain(
      'comment adjacent to translatable whitespace'
    );
  });

  it('diagnoses dynamic content and every unsupported metadata field', async () => {
    const result = await extractFixtures(['invalid.vue']);
    const messages = result.errors.join('\n');

    expect(result.updates).toEqual([]);
    expect(messages).toContain('dynamic content');
    expect(messages).toContain('$maxChars');
    expect(messages).toContain('$format');
    expect(messages).toContain('"name"');
    expect(messages).toContain('$id');
    expect(messages).toContain('dynamic context');
    expect(messages).toContain('v-if');
    expect(messages).toContain('dynamic translatable prop "title"');
    expect(messages).toContain('unsupported value prop');
    expect(messages).toMatch(/invalid\.vue.*\(6:1\)/);
  });

  it('diagnoses context bindings whose modifiers change the runtime prop', async () => {
    const result = await extractFixtures(['context-modifier.vue']);

    expect(result.updates).toEqual([]);
    expect(result.errors.join('\n')).toContain(
      'unsupported directive :context.prop'
    );
  });

  it('uses Vue component-name normalization while preserving native tags', async () => {
    const result = await extractFixtures(['normalization.vue']);

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].source).toEqual([
      { i: 1, k: '_gt_date_1', v: 'd' },
      { t: 'var', i: 2, c: 'native' },
    ]);
  });

  it('ignores type-only gt-vue imports', async () => {
    const result = await extractFixtures(['type-only.vue']);

    expect(result.errors).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  it('resolves static Options API component registrations', async () => {
    const result = await extractFixtures([
      'options-api.vue',
      'options-api-define-component.vue',
    ]);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      'Options API',
      'Defined component',
    ]);
  });

  it('exposes statically returned setup translation functions to templates', async () => {
    const result = await extractFixtures(['options-api-setup.vue']);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      'Composition API',
      'Setup component',
      'Setup string',
      'Setup message',
      'Setup msg',
    ]);
    expect(result.updates.at(-1)?.metadata).toMatchObject({
      context: 'classic',
    });
  });

  it('propagates top-level component aliases with Branch semantics', async () => {
    const result = await extractFixtures(['component-aliases.vue']);
    const expectedSource: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: { b: { formal: 'Hello' }, t: 'b' },
      c: 'Fallback',
    };

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      dataFormat: 'JSX',
      source: expectedSource,
    });
  });

  it('extracts branch props that match Object.prototype names', async () => {
    const result = await extractFixtures(['branch-object-keys.vue']);

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      dataFormat: 'JSX',
      source: {
        t: 'Branch',
        i: 1,
        d: {
          b: {
            constructor: 'Constructor branch',
            toString: 'String branch',
          },
          t: 'b',
        },
        c: ' Fallback ',
      },
    });
  });

  it('ignores listeners and diagnoses directives that alter branch props', async () => {
    const result = await extractFixtures(['branch-directives.vue']);
    const errors = result.errors.join('\n');

    expect(errors).not.toContain('unsupported directive @click');
    expect(errors).toContain('unsupported directive v-model');
    expect(errors).toContain('unsupported directive :foo-bar.camel');
  });

  it('keeps component tags separate from v-for and v-slot bindings', async () => {
    const result = await extractFixtures(['template-namespaces.vue']);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      'Loop scope',
      'Slot scope',
    ]);
  });

  it('extracts a nested translation rendered through an opaque Var slot', async () => {
    const result = await extractFixtures(['nested-var.vue']);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      [' Outer ', { i: 1, k: '_gt_value_1', v: 'v' }],
      'Inner',
    ]);
  });

  it('extracts rich Vue JSX alongside string calls', async () => {
    const result = await extractFixtures(['vue-jsx.tsx']);

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(2);
    expect(result.updates[0]).toMatchObject({
      dataFormat: 'STRING',
      source: 'TSX string',
    });
    expect(result.updates[1]).toMatchObject({
      dataFormat: 'JSX',
      source: 'Rich TSX',
    });
  });

  it('extracts static default and independent named slots while diagnosing invalid T content', async () => {
    const result = await extractFixtures(['unsupported-slots.vue']);
    const errors = result.errors.join('\n');

    expect(result.updates).toHaveLength(2);
    expect(result.updates.map(({ source }) => source)).toEqual([
      { t: 'Card', i: 1, c: ' Body ' },
      'Header',
    ]);
    expect(errors).toContain('bare <template>');
    expect(errors).toContain('nested gt-vue <T>');
  });

  function fixturePath(name: string): string {
    return path.join(__dirname, 'fixtures', name);
  }

  async function extractFixtures(
    filenames: string[],
    options: {
      includeSourceCodeContext?: boolean;
      vueCompilerOptions?: VueCompilerOptions;
    } = {}
  ) {
    const updates: VueExtractionResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const filename of filenames) {
      const file = fixturePath(filename);
      const result = await extractFromVueSource(
        fs.readFileSync(file, 'utf8'),
        file,
        {
          compilerOptions: options.vueCompilerOptions,
          includeSourceCodeContext: options.includeSourceCodeContext ?? false,
          projectRoot: process.cwd(),
        }
      );
      updates.push(...result.results);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return { updates, errors, warnings };
  }
});

describe('Vue T metadata extraction', () => {
  it('extracts canonical, sugar, and idiomatic template metadata props', async () => {
    const output = await extractTemplate(`
      <T context="card" id="hero" :max-chars="-12" requires-review>
        Primary
      </T>
      <T :$context="'alias'" :$id="'alias-id'" :$maxChars="0" :$requiresReview="false">
        Alias
      </T>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toHaveLength(2);
    expect(output.results[0]?.metadata).toMatchObject({
      context: 'card',
      id: 'hero',
      maxChars: 12,
      requiresReview: true,
    });
    expect(output.results[1]?.metadata).toMatchObject({
      context: 'alias',
      id: 'alias-id',
      maxChars: 0,
      requiresReview: false,
    });
  });

  it('extracts canonical and sugar JSX metadata props', async () => {
    const output = await extractJsx(`
      const translationContext = 'card';
      const translationId = 'hero';
      const limit = -9;
      export const View = () => <>
        <T context={translationContext} $id={translationId} maxChars={limit} requiresReview>
          Primary
        </T>
        <T $context="alias" id="alias-id" $maxChars={0} $requiresReview={false}>
          Alias
        </T>
      </>;
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toHaveLength(2);
    expect(output.results[0]?.metadata).toMatchObject({
      context: 'card',
      id: 'hero',
      maxChars: 9,
      requiresReview: true,
    });
    expect(output.results[1]?.metadata).toMatchObject({
      context: 'alias',
      id: 'alias-id',
      maxChars: 0,
      requiresReview: false,
    });
  });

  it.each([
    ['context', 'context="first" :$context="\'second\'"'],
    ['id', 'id="first" :$id="\'second\'"'],
    ['maxChars', ':maxChars="1" :max-chars="2"'],
    ['requiresReview', 'requiresReview :requires-review="false"'],
  ])(
    'rejects duplicate template %s aliases',
    async (metadataKey, attributes) => {
      const output = await extractTemplate(`<T ${attributes}>Duplicate</T>`);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        `duplicate ${metadataKey} props`
      );
    }
  );

  it.each([
    ['context', 'context="first" $context="second"'],
    ['id', 'id="first" $id="second"'],
    ['maxChars', 'maxChars={1} $maxChars={2}'],
    ['requiresReview', 'requiresReview $requiresReview={false}'],
  ])('rejects duplicate JSX %s aliases', async (metadataKey, attributes) => {
    const output = await extractJsx(
      `export const View = () => <T ${attributes}>Duplicate</T>;`
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      `duplicate ${metadataKey} props`
    );
  });

  it.each([
    ['dynamic id', ':id="dynamicId"', 'invalid or dynamic id'],
    ['string maxChars', 'max-chars="10"', 'invalid or dynamic maxChars'],
    ['fractional maxChars', ':max-chars="1.5"', 'invalid or dynamic maxChars'],
    ['NaN maxChars', ':max-chars="NaN"', 'invalid or dynamic maxChars'],
    [
      'string requiresReview',
      'requires-review="false"',
      'invalid or dynamic requiresReview',
    ],
    [
      'dynamic requiresReview',
      ':requires-review="dynamicReview"',
      'invalid or dynamic requiresReview',
    ],
  ])(
    'fails closed on template $name',
    async (_name, attributes, diagnostic) => {
      const output = await extractTemplate(
        `<T ${attributes}>Invalid</T>`,
        `const dynamicId = String(Date.now()); const dynamicReview = Boolean(Date.now());`
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(diagnostic);
    }
  );

  it.each([
    ['dynamic id', 'id={dynamicId}', 'invalid or dynamic id'],
    ['string maxChars', 'maxChars="10"', 'invalid or dynamic maxChars'],
    ['fractional maxChars', 'maxChars={1.5}', 'invalid or dynamic maxChars'],
    [
      'string requiresReview',
      'requiresReview="false"',
      'invalid or dynamic requiresReview',
    ],
    [
      'dynamic requiresReview',
      'requiresReview={dynamicReview}',
      'invalid or dynamic requiresReview',
    ],
  ])('fails closed on JSX $name', async (_name, attributes, diagnostic) => {
    const output = await extractJsx(`
      const dynamicId = String(Date.now());
      const dynamicReview = Boolean(Date.now());
      export const View = () => <T ${attributes}>Invalid</T>;
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(diagnostic);
  });

  it.each(['Num', 'Currency', 'DateTime'])(
    'rejects named template <%s> variables until named variables are supported',
    async (component) => {
      const output = await extractTemplate(
        `<T>Value: <${component} name="named" :value="value" /></T>`,
        'const value = 1;',
        `T, ${component}`
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        `unsupported name prop on a gt-vue <${component}>`
      );
    }
  );

  it.each(['Num', 'Currency', 'DateTime'])(
    'rejects named JSX <%s> variables until named variables are supported',
    async (component) => {
      const output = await extractJsx(
        `export const View = () => <T>Value: <${component} name="named" value={1} /></T>;`,
        `T, ${component}`
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        `unsupported name prop on a gt-vue <${component}>`
      );
    }
  );

  it('hashes maxChars and review while keeping id metadata-only', async () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        dependencies: { 'gt-vue': '1.0.0', vue: '3.5.0' },
      }),
      'src/App.vue': `
        <script setup>
        import { T } from 'gt-vue';
        </script>
        <template>
          <T context="catalog" id="legacy" :max-chars="-12" requires-review>Review metadata</T>
          <T :max-chars="0">Zero metadata</T>
          <T :requires-review="false">False review</T>
        </template>
      `,
    });
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates).toHaveLength(3);
    const review = output.updates.find(
      ({ source }) => source === 'Review metadata'
    );
    expect(review?.metadata).toMatchObject({
      context: 'catalog',
      id: 'legacy',
      maxChars: 12,
      requiresReview: true,
      hash: hashSource({
        source: 'Review metadata',
        context: 'catalog',
        maxChars: 12,
        requiresReview: true,
        dataFormat: 'JSX',
      }),
    });

    const zero = output.updates.find(
      ({ source }) => source === 'Zero metadata'
    );
    expect(zero?.metadata.maxChars).toBe(0);
    expect(zero?.metadata.hash).toBe(
      hashSource({
        source: 'Zero metadata',
        maxChars: 0,
        dataFormat: 'JSX',
      })
    );

    const falseReview = output.updates.find(
      ({ source }) => source === 'False review'
    );
    expect(falseReview?.metadata.requiresReview).toBe(false);
    expect(falseReview?.metadata.hash).toBe(
      hashSource({ source: 'False review', dataFormat: 'JSX' })
    );
  });

  async function extractTemplate(template: string, setup = '', imports = 'T') {
    return extractFromVueSource(
      `<script setup>
      import { ${imports} } from 'gt-vue';
      ${setup}
    </script>
    <template>${template}</template>`,
      '/project/src/App.vue',
      { projectRoot: '/project' }
    );
  }

  async function extractJsx(source: string, imports = 'T') {
    return extractFromVueSource(
      `import { ${imports} } from 'gt-vue'; ${source}`,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );
  }
});
