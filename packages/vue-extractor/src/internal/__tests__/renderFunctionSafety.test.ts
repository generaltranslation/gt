import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

type RenderSafetyProbe = {
  /** Human-readable unsupported rich-render path exercised by the probe. */
  name: string;
  /** Complete SFC source for the render path. */
  source: string;
  /** Diagnostic fragment proving that extraction failed closed. */
  diagnostic: string;
};

/**
 * Safety cases for programmatic rich `<T>` rendering.
 *
 * Rich translation extraction supports declarative SFC templates and Vue
 * JSX/TSX. Programmatic `h()` and `createVNode()` calls, plus async component
 * wrappers that visibly receive imported `<T>`, must still fail closed instead
 * of silently producing an empty catalog.
 */
const renderSafetyProbes: RenderSafetyProbe[] = [
  {
    name: 'an Options API render function calls h with T',
    source: `<script>
      import { h } from 'vue';
      import { T } from 'gt-vue';
      export default { render() { return h(T, null, 'Hello'); } };
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'an Options API render function calls createVNode with T',
    source: `<script>
      import { createVNode } from 'vue';
      import { T } from 'gt-vue';
      export default { render() { return createVNode(T, null, 'Hello'); } };
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'an Options API setup function returns a render function with T',
    source: `<script>
      import { h } from 'vue';
      import { T } from 'gt-vue';
      export default { setup() { return () => h(T, null, 'Hello'); } };
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'a defineComponent render function calls h with T',
    source: `<script>
      import { defineComponent, h } from 'vue';
      import { T } from 'gt-vue';
      export default defineComponent({
        render() { return h(T, null, 'Hello'); },
      });
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'script setup passes T to createVNode used as a component',
    source: `<script setup>
      import { createVNode } from 'vue';
      import { T } from 'gt-vue';
      const vnode = createVNode(T, null, 'Hello');
    </script>
    <template><component :is="vnode" /></template>`,
    diagnostic: 'possible gt-vue component alias',
  },
  {
    name: 'resolveDynamicComponent receives T',
    source: `<script setup>
      import { resolveDynamicComponent } from 'vue';
      import { T } from 'gt-vue';
      const selected = resolveDynamicComponent(T);
    </script>
    <template><component :is="selected">Hello</component></template>`,
    diagnostic: 'possible gt-vue component alias',
  },
  {
    name: 'defineAsyncComponent resolves to T',
    source: `<script setup>
      import { defineAsyncComponent } from 'vue';
      import { T } from 'gt-vue';
      const selected = defineAsyncComponent(() => Promise.resolve(T));
    </script>
    <template><component :is="selected">Hello</component></template>`,
    diagnostic: 'gt-vue',
  },
];

describe('programmatic rich translation safety', () => {
  it.each(renderSafetyProbes)('$name', async ({ source, diagnostic }) => {
    const output = await extractFromVueSource(
      source,
      '/fixtures/RenderFunctionSafety.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(diagnostic);
  });
});
