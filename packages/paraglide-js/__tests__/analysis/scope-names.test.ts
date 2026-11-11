import { describe, expect, test } from 'vitest';
import { analyzeProject } from '../helpers/project.js';

const IMPORT = `import { m } from "./paraglide/messages.js";\n`;

/** `name scope` for each usage of `code`, analyzed as `file`. */
async function scopes(file: string, code: string): Promise<string[]> {
  const usages = await analyzeProject({ [file]: code }, { entry: file });
  return usages.map((usage) => `${usage.name} ${usage.scope ?? '-'}`);
}

describe('S1: class field initializers', () => {
  test('instance, static, object, accessor and #private fields', async () => {
    expect(
      await scopes(
        '/app/src/fields.ts',
        IMPORT +
          [
            'export class Card {',
            '  label = m.field_instance();',
            '  static title = m.field_static();',
            '  state = { text: m.field_object() };',
            '  accessor heading = m.field_accessor();',
            '  #secret = m.field_private();',
            '  onClick = () => m.field_arrow();',
            '  static { m.static_block(); }',
            '}',
          ].join('\n')
      )
    ).toEqual([
      'field_instance Card.label',
      'field_static static Card.title',
      'field_object Card.state',
      'field_accessor Card.heading',
      'field_private Card.#secret',
      'field_arrow Card.onClick',
      'static_block Card',
    ]);
  });
});

describe('S2: #private methods', () => {
  test('Class.#method', async () => {
    expect(
      await scopes(
        '/app/src/fields.ts',
        IMPORT +
          'class Card {\n  #secret() {\n    return m.private_method();\n  }\n}\n'
      )
    ).toEqual(['private_method Card.#secret']);
  });
});

describe('S3: wrapper callbacks are weak names', () => {
  test("hooks inside a component take the component's name", async () => {
    expect(
      await scopes(
        '/app/src/Hooks.tsx',
        IMPORT +
          [
            'export function Hooks() {',
            '  const memo = useMemo(() => m.hook_memo(), []);',
            '  const onClick = useCallback(() => m.hook_callback(), []);',
            '  const handler = () => m.hook_handler();',
            '  return <button onClick={onClick}>{memo}</button>;',
            '}',
          ].join('\n')
      )
    ).toEqual([
      'hook_memo Hooks',
      'hook_callback Hooks',
      'hook_handler handler',
    ]);
  });

  test('a module-level wrapper names the component', async () => {
    expect(
      await scopes(
        '/app/src/Button.tsx',
        IMPORT +
          [
            'export const Button = memo(forwardRef(() => <p>{m.wrapped()}</p>));',
            'export const Header = component$(() => {',
            '  const label = useComputed$(() => m.computed());',
            '  return <h1>{label.value}</h1>;',
            '});',
          ].join('\n')
      )
    ).toEqual(['wrapped Button', 'computed Header']);
  });
});

describe('S4: chains, parentheses, satisfies and arrays', () => {
  test('climb to the variable', async () => {
    expect(
      await scopes(
        '/app/src/chains.ts',
        IMPORT +
          [
            'export const subscribe = createServerFn()',
            '  .validator(() => m.chain_middle())',
            '  .handler(() => m.chain_last());',
            'export const wrapped = (() => m.chain_satisfies()) satisfies () => string;',
            'export const middleware = [() => m.chain_array()];',
            'export const optional = maybe?.(() => m.chain_optional());',
          ].join('\n')
      )
    ).toEqual([
      'chain_middle subscribe',
      'chain_last subscribe',
      'chain_satisfies wrapped',
      'chain_array middleware',
      'chain_optional optional',
    ]);
  });
});

describe('S5: generic names', () => {
  test('default exports are named after the file', async () => {
    expect(
      await scopes(
        '/app/server/api/greeting.get.ts',
        `import { m } from "../../src/paraglide/messages.js";\n` +
          'export default defineEventHandler(() => m.event_handler());\n'
      )
    ).toEqual(['event_handler greeting.get']);
    expect(
      await scopes(
        '/app/src/plugin.ts',
        IMPORT +
          'export default function () {\n  return m.default_function();\n}\n'
      )
    ).toEqual(['default_function plugin']);
    expect(
      await scopes(
        '/app/src/counter.svelte.ts',
        IMPORT + 'export default class {\n  label = m.default_class();\n}\n'
      )
    ).toEqual(['default_class counter.label']);
  });

  test('setup() is named after its component', async () => {
    expect(
      await scopes(
        '/app/src/Comp.tsx',
        IMPORT +
          [
            'export const Comp = defineComponent({',
            '  setup() {',
            '    return () => <p>{m.vue_jsx_setup()}</p>;',
            '  },',
            '});',
          ].join('\n')
      )
    ).toEqual(['vue_jsx_setup Comp']);
    expect(
      await scopes(
        '/app/src/Options.ts',
        IMPORT +
          'export default defineComponent({\n  setup() {\n    return { t: m.options_setup() };\n  },\n});\n'
      )
    ).toEqual(['options_setup Options']);
  });

  test('prop defaults are named after the component', async () => {
    expect(
      await scopes(
        '/app/src/Scripts.vue',
        [
          '<script setup lang="ts">',
          `import { m } from "./paraglide/messages.js";`,
          'const props = withDefaults(defineProps<{ title?: string }>(), {',
          '  title: () => m.prop_default(),',
          '});',
          '</script>',
        ].join('\n')
      )
    ).toEqual(['prop_default Scripts']);
  });

  test('object literal keys still name their functions', async () => {
    expect(
      await scopes(
        '/app/src/keys.ts',
        IMPORT + 'export const x = { foo: () => m.key_arrow() };\n'
      )
    ).toEqual(['key_arrow foo']);
  });
});
