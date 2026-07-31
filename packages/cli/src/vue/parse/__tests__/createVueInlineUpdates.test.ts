import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { matchFiles } from '../../../fs/matchFiles.js';
import { createVueInlineUpdates } from '../createVueInlineUpdates.js';
import type { GTParsingFlags } from '../../../types/parsing.js';

vi.mock('../../../fs/matchFiles.js', () => ({ matchFiles: vi.fn() }));

const parsingFlags: GTParsingFlags = {
  autoderive: false,
  enableAutoJsxInjection: false,
  includeSourceCodeContext: false,
  legacyGtReactImportSource: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createVueInlineUpdates', () => {
  it('extracts context-only strings and a runtime-compatible rich source tree', async () => {
    const fixture = fixturePath('rich.vue');
    vi.mocked(matchFiles).mockReturnValue([fixture]);

    const result = await createVueInlineUpdates(undefined, {
      ...parsingFlags,
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
        c: ['Hello ', { i: 2, k: '_gt_value_2', v: 'v' }, '!'],
      },
      {
        t: 'Plural',
        i: 3,
        d: {
          b: {
            one: ['one ', { i: 4, k: '_gt_value_4', v: 'v' }],
            other: ['other ', { i: 4, k: '_gt_value_4', v: 'v' }],
          },
          t: 'p',
        },
        c: ['fallback ', { i: 4, k: '_gt_value_4', v: 'v' }],
      },
      {
        t: 'Branch',
        i: 5,
        d: {
          b: {
            formal: ['formal ', { i: 6, k: '_gt_value_6', v: 'v' }],
            casual: ['casual ', { i: 6, k: '_gt_value_6', v: 'v' }],
          },
          t: 'b',
        },
        c: ['fallback ', { i: 6, k: '_gt_value_6', v: 'v' }],
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
    expect(rich?.metadata.hash).toBe(
      hashSource({
        context: 'hero',
        dataFormat: 'JSX',
        source: expectedRichSource,
      })
    );

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

  it('coalesces text separated by Vue comment nodes', async () => {
    vi.mocked(matchFiles).mockReturnValue([fixturePath('comments.vue')]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      dataFormat: 'JSX',
      source: 'Hello world',
    });
  });

  it('diagnoses dynamic content and every unsupported metadata field', async () => {
    vi.mocked(matchFiles).mockReturnValue([fixturePath('invalid.vue')]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);
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
    expect(messages).toMatch(/invalid\.vue.*\(4:1\)/);
  });

  it('uses Vue component-name normalization while preserving native tags', async () => {
    vi.mocked(matchFiles).mockReturnValue([fixturePath('normalization.vue')]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].source).toEqual([
      { i: 1, k: '_gt_date_1', v: 'd' },
      { t: 'var', i: 2, c: 'native' },
    ]);
  });

  it('ignores type-only gt-vue imports', async () => {
    vi.mocked(matchFiles).mockReturnValue([fixturePath('type-only.vue')]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.errors).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  it('resolves static Options API component registrations', async () => {
    vi.mocked(matchFiles).mockReturnValue([
      fixturePath('options-api.vue'),
      fixturePath('options-api-define-component.vue'),
    ]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      'Options API',
      'Defined component',
    ]);
  });

  it('exposes statically returned setup translation functions to templates', async () => {
    vi.mocked(matchFiles).mockReturnValue([
      fixturePath('options-api-setup.vue'),
    ]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      'Composition API',
      'Setup string',
      'Setup message',
      'Setup msg',
    ]);
    expect(result.updates.at(-1)?.metadata).toMatchObject({
      context: 'classic',
    });
  });

  it('propagates top-level component aliases with Branch semantics', async () => {
    vi.mocked(matchFiles).mockReturnValue([
      fixturePath('component-aliases.vue'),
    ]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);
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
    expect(result.updates[0].metadata.hash).toBe(
      hashSource({ dataFormat: 'JSX', source: expectedSource })
    );
  });

  it('diagnoses directives that would add runtime branch props', async () => {
    vi.mocked(matchFiles).mockReturnValue([
      fixturePath('branch-directives.vue'),
    ]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);
    const errors = result.errors.join('\n');

    expect(errors).toContain('unsupported directive @click');
    expect(errors).toContain('unsupported directive v-model');
    expect(errors).toContain('unsupported directive :foo-bar.camel');
  });

  it('keeps component tags separate from v-for and v-slot bindings', async () => {
    vi.mocked(matchFiles).mockReturnValue([
      fixturePath('template-namespaces.vue'),
    ]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      'Loop scope',
      'Slot scope',
    ]);
  });

  it('extracts a nested translation rendered through an opaque Var slot', async () => {
    vi.mocked(matchFiles).mockReturnValue([fixturePath('nested-var.vue')]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.errors).toEqual([]);
    expect(result.updates.map((update) => update.source)).toEqual([
      ['Outer ', { i: 1, k: '_gt_value_1', v: 'v' }],
      'Inner',
    ]);
  });

  it('diagnoses rich Vue JSX while retaining string-call extraction', async () => {
    vi.mocked(matchFiles).mockReturnValue([fixturePath('vue-jsx.tsx')]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      dataFormat: 'STRING',
      source: 'TSX string',
    });
    expect(result.errors.join('\n')).toContain(
      'gt-vue <T> component in Vue JSX or TSX'
    );
  });

  it('diagnoses named slots on ordinary components and bare templates', async () => {
    vi.mocked(matchFiles).mockReturnValue([
      fixturePath('unsupported-slots.vue'),
    ]);

    const result = await createVueInlineUpdates(undefined, parsingFlags);
    const errors = result.errors.join('\n');

    expect(result.updates).toEqual([]);
    expect(errors).toContain('named slots on <Card>');
    expect(errors).toContain('bare <template>');
    expect(errors).toContain('nested gt-vue <T>');
  });
});

function fixturePath(name: string): string {
  return path.join(__dirname, 'fixtures', name);
}
