import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue string function alias';

type StringFactoryProbe = {
  /** Human-readable string-function factory flow under test. */
  name: string;
  /** Statements inserted into the fixture's script-setup block. */
  script: string;
  /** Source passed to the resulting function call. */
  source: string;
  /** Whether the called value can be a gt-vue string function. */
  possibleGT: boolean;
};

/**
 * Local factories and identity functions can return `useGT()`,
 * `useMessages()`, or `msg` without changing the function's GT provenance.
 * Conditional factory results need a diagnostic when exact extraction is not
 * possible, while an entirely ordinary factory must stay silent.
 */
const stringFactoryProbes: StringFactoryProbe[] = [
  {
    name: 'an arrow factory returns a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const make = () => useGT();
      const gt = make();
      gt('Arrow factory');
    `,
    source: 'Arrow factory',
    possibleGT: true,
  },
  {
    name: 'a function factory returns msg',
    script: `
      import { msg } from 'gt-vue';
      function make() { return msg; }
      const message = make();
      message('Function factory');
    `,
    source: 'Function factory',
    possibleGT: true,
  },
  {
    name: 'an identity function returns a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const identity = (value) => value;
      const gt = identity(useGT());
      gt('Identity factory');
    `,
    source: 'Identity factory',
    possibleGT: true,
  },
  {
    name: 'a factory returns an object containing a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const make = () => ({ fn: useGT() });
      const holder = make();
      holder.fn('Object factory');
    `,
    source: 'Object factory',
    possibleGT: true,
  },
  {
    name: 'a function selects a useGT argument',
    script: `
      import { useGT } from 'gt-vue';
      function select(value) { return value; }
      const gt = select(useGT());
      gt('Argument selector');
    `,
    source: 'Argument selector',
    possibleGT: true,
  },
  {
    name: 'a conditional binding may be a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const gt = flag ? useGT() : String;
      gt('Conditional binding');
    `,
    source: 'Conditional binding',
    possibleGT: true,
  },
  {
    name: 'a factory may return a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const make = () => flag ? useGT() : String;
      const gt = make();
      gt('Conditional factory');
    `,
    source: 'Conditional factory',
    possibleGT: true,
  },
  {
    name: 'a factory returns a useMessages result',
    script: `
      import { useMessages } from 'gt-vue';
      const make = () => useMessages();
      const m = make();
      m('Messages factory');
    `,
    source: 'Messages factory',
    possibleGT: true,
  },
  {
    name: 'an ordinary factory stays silent',
    script: `
      const make = () => String;
      const ordinary = make();
      ordinary('Ordinary factory');
    `,
    source: 'Ordinary factory',
    possibleGT: false,
  },
];

describe('string-function factory semantics', () => {
  it.each(stringFactoryProbes)(
    '$name',
    async ({ script, source, possibleGT }) => {
      const output = await extractFromVueSource(
        `<script setup>
          const flag = Boolean(Date.now());
          ${script}
        </script><template><div /></template>`,
        '/fixtures/StringFactorySemantics.vue',
        { projectRoot: '/fixtures' }
      );
      const extracted = output.results.some(
        (result) => result.source === source
      );
      const diagnosed = output.errors.some((error) =>
        error.includes(POSSIBLE_ALIAS_DIAGNOSTIC)
      );

      if (possibleGT) {
        expect(extracted || diagnosed).toBe(true);
      } else {
        expect(output.results).toEqual([]);
        expect(output.errors).toEqual([]);
      }
    }
  );
});
