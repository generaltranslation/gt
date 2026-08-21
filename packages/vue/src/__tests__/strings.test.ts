import { hashStringMessage } from 'gt-i18n/internal/string';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { createGT, useGT, useMessages } from '../index';

describe('gt-vue string lookups', () => {
  it('falls back to source text when a STRING hash resolves to rich data', async () => {
    const source = 'Hello';
    const plugin = createGT({
      loadTranslations: async () => ({
        [hashStringMessage(source)]: {
          c: 'Wrong catalog shape',
          i: 1,
          t: 'p',
        },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        const gt = useGT();
        const m = useMessages();
        return () => h('p', `${gt(source)}|${m(source)}`);
      },
    });
    const app = createSSRApp(Root).use(plugin);

    expect(await renderToString(app)).toContain('Hello|Hello');
  });
});
