import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type LiveObjectProbe = {
  /** Human-readable object-identity behavior exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script-setup block. */
  code: string;
  /** Dynamic component expression read after script setup completes. */
  selector: string;
  /** Whether the selector resolves to `<T>` in the final runtime state. */
  possibleT: boolean;
};

/**
 * Getters and prototype chains are live views, not construction-time copies.
 * The extractor must use the same final identity state that Vue observes when
 * rendering a template. Shadowing and deletion must likewise expose exactly
 * the own or inherited member JavaScript would read at render time.
 */
const liveObjectProbes: LiveObjectProbe[] = [
  {
    name: 'an object getter reads a later T binding',
    code: `
      let value = String;
      const registry = { get x() { return value; } };
      value = T;
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'an object getter reads a later ordinary binding',
    code: `
      let value = T;
      const registry = { get x() { return value; } };
      value = String;
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'a class getter reads a later T binding',
    code: `
      let value = String;
      class Registry { get x() { return value; } }
      const registry = new Registry();
      value = T;
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'a class getter reads a later ordinary binding',
    code: `
      let value = T;
      class Registry { get x() { return value; } }
      const registry = new Registry();
      value = String;
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'a class field retains T',
    code: `
      class Registry { x = T; }
      const registry = new Registry();
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'an ordinary class field stays silent',
    code: `
      class Registry { x = String; }
      const registry = new Registry();
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'a class constructor assignment retains T',
    code: `
      class Registry { constructor() { this.x = T; } }
      const registry = new Registry();
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'an ordinary class constructor assignment stays silent',
    code: `
      class Registry { constructor() { this.x = String; } }
      const registry = new Registry();
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'Object.create observes a later T prototype write',
    code: `
      const prototype = { x: String };
      const registry = Object.create(prototype);
      prototype.x = T;
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'Object.create observes a later ordinary prototype write',
    code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      prototype.x = String;
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'setPrototypeOf observes a later T prototype write',
    code: `
      const prototype = { x: String };
      const registry = {};
      Object.setPrototypeOf(registry, prototype);
      prototype.x = T;
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'setPrototypeOf observes a later ordinary prototype write',
    code: `
      const prototype = { x: T };
      const registry = {};
      Object.setPrototypeOf(registry, prototype);
      prototype.x = String;
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'an ordinary own property shadows an inherited T',
    code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      registry.x = String;
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'deleting an ordinary own property reveals inherited T',
    code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      registry.x = String;
      delete registry.x;
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'deleting a T own property reveals an ordinary inherited value',
    code: `
      const prototype = { x: String };
      const registry = Object.create(prototype);
      registry.x = T;
      delete registry.x;
    `,
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'deleting through a detached nested alias removes T',
    code: `
      const registry = { box: { x: T } };
      const box = registry.box;
      registry.box = { x: String };
      delete box.x;
    `,
    selector: 'box[key]',
    possibleT: false,
  },
  {
    name: 'an object getter reads T through its receiver',
    code: `
      const registry = { value: T, get x() { return this.value; } };
    `,
    selector: 'registry.x',
    possibleT: true,
  },
  {
    name: 'an object getter observes a receiver mutation',
    code: `
      const registry = { value: T, get x() { return this.value; } };
      registry.value = String;
    `,
    selector: 'registry.x',
    possibleT: false,
  },
  {
    name: 'an object method reads T through its receiver',
    code: `
      const registry = { value: T, read() { return this.value; } };
    `,
    selector: 'registry.read()',
    possibleT: true,
  },
  {
    name: 'an object method observes a receiver mutation',
    code: `
      const registry = { value: T, read() { return this.value; } };
      registry.value = String;
    `,
    selector: 'registry.read()',
    possibleT: false,
  },
  {
    name: 'a class getter reads T through its receiver',
    code: `
      class Registry {
        value = T;
        get x() { return this.value; }
      }
      const registry = new Registry();
    `,
    selector: 'registry.x',
    possibleT: true,
  },
  {
    name: 'a class getter observes a receiver mutation',
    code: `
      class Registry {
        value = T;
        get x() { return this.value; }
      }
      const registry = new Registry();
      registry.value = String;
    `,
    selector: 'registry.x',
    possibleT: false,
  },
  {
    name: 'a class method reads T through its receiver',
    code: `
      class Registry {
        value = T;
        read() { return this.value; }
      }
      const registry = new Registry();
    `,
    selector: 'registry.read()',
    possibleT: true,
  },
  {
    name: 'a class method observes a receiver mutation',
    code: `
      class Registry {
        value = T;
        read() { return this.value; }
      }
      const registry = new Registry();
      registry.value = String;
    `,
    selector: 'registry.read()',
    possibleT: false,
  },
];

describe('live getter and prototype identity semantics', () => {
  it.each(liveObjectProbes)('$name', async ({ code, selector, possibleT }) => {
    const output = await extractFromVueSource(
      createFixture(code, selector),
      '/fixtures/LiveObjectSemantics.vue',
      { projectRoot: '/fixtures' }
    );
    const extracted = output.results.some(({ source }) => source === 'Hidden');
    const diagnosed = output.errors.some((error) =>
      error.includes(POSSIBLE_ALIAS_DIAGNOSTIC)
    );

    if (possibleT) {
      expect(extracted || diagnosed).toBe(true);
    } else {
      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  });
});

/** Creates an SFC that reads one final live-object selector. */
function createFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    const key = getKey();
    ${code}
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}
