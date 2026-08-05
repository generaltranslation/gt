import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

describe('Vue variable component interface validation', () => {
  it('accepts explicit dynamic value props outside T in SFC templates', async () => {
    const output = await extractFromVueSource(
      `
        <script setup lang="ts">
          import * as GT from 'gt-vue';
          import { Num as Count } from 'gt-vue';
          const amount = Math.random();
          const date = new Date();
        </script>
        <template>
          <Count :value="amount" />
          <GT.Currency :value="amount" />
          <GT.DateTime :value="date" />
        </template>
      `,
      '/project/src/View.vue'
    );

    expect(output.errors).toEqual([]);
  });

  it('rejects invalid direct, aliased, and namespaced SFC uses outside T', async () => {
    const output = await extractFromVueSource(
      `
        <script setup lang="ts">
          import * as GT from 'gt-vue';
          import { Num as Count, Var as Value } from 'gt-vue';
          const date = new Date();
          const name = 'Ada';
        </script>
        <template>
          <Count />
          <GT.DateTime :value="date">{{ date }}</GT.DateTime>
          <Value :value="name">{{ name }}</Value>
        </template>
      `,
      '/project/src/View.vue'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(3);
    expect(output.errors.join('\n')).toContain(
      'gt-vue <Num> component without a value prop'
    );
    expect(output.errors.join('\n')).toContain(
      'children on a gt-vue <DateTime> component'
    );
    expect(output.errors.join('\n')).toContain('unsupported value prop');
  });

  it('reports each invalid SFC use inside T only once', async () => {
    const output = await extractFromVueSource(
      `
        <script setup lang="ts">
          import { Num, T } from 'gt-vue';
        </script>
        <template><T><Num /></T></template>
      `,
      '/project/src/View.vue'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('without a value prop');
  });

  it('accepts explicit dynamic value props outside T in TSX', async () => {
    const output = await extractFromVueSource(
      `
        import * as GT from 'gt-vue';
        import { Num as Count } from 'gt-vue';
        const amount = Math.random();
        const date = new Date();
        export const View = () => <><Count value={amount} /><GT.Currency value={amount} /><GT.DateTime value={date} /></>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
  });

  it('rejects invalid direct, aliased, and namespaced TSX uses outside T', async () => {
    const output = await extractFromVueSource(
      `
        import * as GT from 'gt-vue';
        import { Num as Count, Var as Value } from 'gt-vue';
        const date = new Date();
        const name = 'Ada';
        export const View = () => <><Count /><GT.DateTime value={date}>{date}</GT.DateTime><Value value={name}>{name}</Value></>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(3);
    expect(output.errors.join('\n')).toContain(
      'gt-vue <Num> component without a value prop'
    );
    expect(output.errors.join('\n')).toContain(
      'children on a gt-vue <DateTime> component'
    );
    expect(output.errors.join('\n')).toContain('unsupported value prop');
  });

  it('reports each invalid TSX use inside T only once', async () => {
    const output = await extractFromVueSource(
      `
        import { Num, T } from 'gt-vue';
        export const View = () => <T><Num /></T>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('without a value prop');
  });
});
