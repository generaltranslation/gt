import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { JsxChildren } from '@generaltranslation/format/types';
import { extractFromVueSource } from '../../index.js';
import type { VueCompilerOptions, VueExtractionResult } from '../../types.js';

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

  it('keeps ordinary component slots opaque while diagnosing invalid T content', async () => {
    const result = await extractFixtures(['unsupported-slots.vue']);
    const errors = result.errors.join('\n');

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]?.source).toEqual({ t: 'Card', i: 1 });
    expect(errors).toContain('bare <template>');
    expect(errors).toContain('nested gt-vue <T>');
  });
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
