import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

type SourcePositionProbe = {
  /** Human-readable JavaScript data flow exercised by the probe. */
  name: string;
  /** Statements inserted into a TypeScript script-setup block. */
  script: string;
  /** Sources that execute through a GT string function at that call site. */
  sources: string[];
};

/**
 * Mutable string-function aliases are resolved at each call's source position.
 * A later write must neither erase an earlier GT call nor retroactively turn an
 * earlier ordinary call into a translation.
 */
const sourcePositionProbes: SourcePositionProbe[] = [
  {
    name: 'extracts an object-member useGT call before reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn('member GT before ordinary');
      holder.fn = String;
      holder.fn('member ordinary after GT');
    `,
    sources: ['member GT before ordinary'],
  },
  {
    name: 'extracts an object-member useGT call after reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      holder.fn('member ordinary before GT');
      holder.fn = useGT();
      holder.fn('member GT after ordinary');
    `,
    sources: ['member GT after ordinary'],
  },
  {
    name: 'extracts an object-member msg call before reassignment',
    script: `
      import { msg } from 'gt-vue';
      const holder = { fn: msg };
      holder.fn('member msg before ordinary');
      holder.fn = String;
      holder.fn('member ordinary after msg');
    `,
    sources: ['member msg before ordinary'],
  },
  {
    name: 'extracts an object-member msg call after reassignment',
    script: `
      import { msg } from 'gt-vue';
      const holder = { fn: String };
      holder.fn('member ordinary before msg');
      holder.fn = msg;
      holder.fn('member msg after ordinary');
    `,
    sources: ['member msg after ordinary'],
  },
  {
    name: 'extracts an object-member useMessages call before reassignment',
    script: `
      import { useMessages } from 'gt-vue';
      const holder = { fn: useMessages() };
      holder.fn('member messages before ordinary');
      holder.fn = String;
      holder.fn('member ordinary after messages');
    `,
    sources: ['member messages before ordinary'],
  },
  {
    name: 'extracts an object-member useMessages call after reassignment',
    script: `
      import { useMessages } from 'gt-vue';
      const holder = { fn: String };
      holder.fn('member ordinary before messages');
      holder.fn = useMessages();
      holder.fn('member messages after ordinary');
    `,
    sources: ['member messages after ordinary'],
  },
  {
    name: 'resolves a computed member at each call position',
    script: `
      import { useGT } from 'gt-vue';
      const key = 'fn';
      const holder = { [key]: useGT() };
      holder[key]('computed GT before ordinary');
      holder[key] = String;
      holder[key]('computed ordinary after GT');
    `,
    sources: ['computed GT before ordinary'],
  },
  {
    name: 'resolves a nested member at each call position',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { api: { fn: String } };
      holder.api.fn('nested ordinary before GT');
      holder.api.fn = useGT();
      holder.api.fn('nested GT after ordinary');
    `,
    sources: ['nested GT after ordinary'],
  },
  {
    name: 'preserves object identity through an alias when a member changes',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      const alias = holder;
      alias.fn('aliased member GT before ordinary');
      holder.fn = String;
      alias.fn('aliased member ordinary after GT');
    `,
    sources: ['aliased member GT before ordinary'],
  },
  {
    name: 'observes a GT member write through an object alias',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      const alias = holder;
      alias.fn('aliased member ordinary before GT');
      holder.fn = useGT();
      alias.fn('aliased member GT after ordinary');
    `,
    sources: ['aliased member GT after ordinary'],
  },
  {
    name: 'keeps a detached member value after the object member changes',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      const detached = holder.fn;
      holder.fn = String;
      detached('detached GT snapshot');
      holder.fn('mutated ordinary member');
    `,
    sources: ['detached GT snapshot'],
  },
  {
    name: 'does not retroactively change an ordinary detached member',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      const detached = holder.fn;
      holder.fn = useGT();
      detached('detached ordinary snapshot');
      holder.fn('mutated GT member');
    `,
    sources: ['mutated GT member'],
  },
  {
    name: 'keeps an aliased old object when its root binding is replaced',
    script: `
      import { useGT } from 'gt-vue';
      let holder = { fn: useGT() };
      const oldHolder = holder;
      holder = { fn: String };
      oldHolder.fn('old root GT member');
      holder.fn('new root ordinary member');
    `,
    sources: ['old root GT member'],
  },
  {
    name: 'uses the replacement object after its root binding changes',
    script: `
      import { useGT } from 'gt-vue';
      let holder = { fn: String };
      const oldHolder = holder;
      holder = { fn: useGT() };
      oldHolder.fn('old root ordinary member');
      holder.fn('new root GT member');
    `,
    sources: ['new root GT member'],
  },
  {
    name: 'extracts an optional object-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn?.('optional member call');
    `,
    sources: ['optional member call'],
  },
  {
    name: 'extracts through an optional object member',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder?.fn('optional object member call');
    `,
    sources: ['optional object member call'],
  },
  {
    name: 'extracts an optional computed-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder?.['fn']?.('optional computed member call');
    `,
    sources: ['optional computed member call'],
  },
  {
    name: 'extracts a non-null object-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn!('non-null member call');
    `,
    sources: ['non-null member call'],
  },
  {
    name: 'extracts a type-wrapped object-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      (holder.fn as typeof holder.fn)('type-wrapped member call');
    `,
    sources: ['type-wrapped member call'],
  },
  {
    name: 'resolves an uninitialized translator through successive writes',
    script: `
      import { useGT } from 'gt-vue';
      let translate;
      translate = useGT();
      translate('uninitialized binding GT phase');
      translate = String;
      translate('uninitialized binding ordinary phase');
    `,
    sources: ['uninitialized binding GT phase'],
  },
  {
    name: 'resolves an uninitialized msg alias through successive writes',
    script: `
      import { msg } from 'gt-vue';
      let message;
      message = String;
      message('uninitialized msg ordinary phase');
      message = msg;
      message('uninitialized msg GT phase');
    `,
    sources: ['uninitialized msg GT phase'],
  },
  {
    name: 'preserves a detached alias from an uninitialized translator',
    script: `
      import { useGT } from 'gt-vue';
      let translate;
      translate = useGT();
      const alias = translate;
      translate = String;
      alias?.('uninitialized detached translator');
    `,
    sources: ['uninitialized detached translator'],
  },
  {
    name: 'preserves a detached alias from an initialized translator',
    script: `
      import { useGT } from 'gt-vue';
      let translate = useGT();
      const alias = translate;
      translate = String;
      alias('initialized detached translator');
    `,
    sources: ['initialized detached translator'],
  },
  {
    name: 'does not retroactively change an ordinary detached alias',
    script: `
      import { useGT } from 'gt-vue';
      let translate = String;
      const alias = translate;
      translate = useGT();
      alias('initialized detached ordinary alias');
      translate('initialized reassigned translator');
    `,
    sources: ['initialized reassigned translator'],
  },
  {
    name: 'resolves an optional member call before reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn?.('optional mutable member GT phase');
      holder.fn = String;
      holder.fn?.('optional mutable member ordinary phase');
    `,
    sources: ['optional mutable member GT phase'],
  },
  {
    name: 'resolves an optional member call after reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      holder.fn?.('optional mutable member ordinary phase');
      holder.fn = useGT();
      holder.fn?.('optional mutable member GT phase');
    `,
    sources: ['optional mutable member GT phase'],
  },
  {
    name: 'resolves a non-null member call before reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn!('non-null mutable member GT phase');
      holder.fn = String;
      holder.fn!('non-null mutable member ordinary phase');
    `,
    sources: ['non-null mutable member GT phase'],
  },
  {
    name: 'resolves a non-null member call after reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      holder.fn!('non-null mutable member ordinary phase');
      holder.fn = useGT();
      holder.fn!('non-null mutable member GT phase');
    `,
    sources: ['non-null mutable member GT phase'],
  },
];

describe('string-function member calls at each source position', () => {
  it.each(sourcePositionProbes)('$name', async ({ script, sources }) => {
    const output = await extractFromVueSource(
      `<script setup lang="ts">${script}</script><template><div /></template>`,
      '/fixtures/MemberCallSourcePosition.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(sources);
  });
});
