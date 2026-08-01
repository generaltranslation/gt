import {
  createRenderer,
  defineComponent,
  h,
  nextTick,
  type Component,
} from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGT, useGT, useLocale } from '../index';
import type { GTPlugin, TranslationCatalog } from '../index';

describe('gt-vue runtime state', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects failed locale changes, preserves the locale, and retries', async () => {
    const error = new Error('catalog unavailable');
    const loadTranslations = vi.fn(async () => {
      throw error;
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const plugin = createGT({ loadTranslations });

    await expect(plugin.setLocale('fr')).rejects.toBe(error);
    expect(plugin.getLocale()).toBe('en');
    await expect(plugin.setLocale('fr')).rejects.toBe(error);

    expect(loadTranslations).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      'Translations could not be loaded for "fr"'
    );
  });

  it('keeps the previous locale when the latest request rejects', async () => {
    const pending = new Map<
      string,
      {
        reject(error: unknown): void;
        resolve(catalog: TranslationCatalog): void;
      }
    >();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const plugin = createGT({
      loadTranslations: (locale) =>
        new Promise((resolve, reject) =>
          pending.set(locale, { reject, resolve })
        ),
    });

    const french = plugin.setLocale('fr');
    const chinese = plugin.setLocale('zh');
    await vi.waitFor(() => expect(pending.size).toBe(2));

    pending.get('zh')?.reject(new Error('zh failed'));
    await expect(chinese).rejects.toThrow('zh failed');
    pending.get('fr')?.resolve({});
    await expect(french).resolves.toBeUndefined();

    expect(plugin.getLocale()).toBe('en');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('does not rerender active consumers when another locale is preloaded', async () => {
    let renders = 0;
    const plugin = createGT({ loadTranslations: async () => ({}) });
    const Root = defineComponent({
      setup() {
        const gt = useGT();
        const locale = useLocale();
        return () => {
          renders += 1;
          return h('p', `${locale.value}:${gt('Hello')}`);
        };
      },
    });
    const mounted = mount(Root, plugin);

    expect(renders).toBe(1);
    await plugin.loadTranslations('fr');
    await nextTick();

    expect(renders).toBe(1);
    mounted.app.unmount();
  });

  it('reports a missing plugin from composition functions', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const Root = defineComponent({
      setup() {
        useGT();
        return () => null;
      },
    });

    expect(() => mount(Root)).toThrow('The GT Vue plugin is not installed');
  });

  it('never calls the loader for the source locale', async () => {
    const loadTranslations = vi.fn(async () => ({ translated: 'value' }));
    const plugin = createGT({ defaultLocale: 'en', loadTranslations });

    await expect(plugin.loadTranslations('en')).resolves.toEqual({});
    expect(loadTranslations).not.toHaveBeenCalled();
  });
});

type HostNode = {
  children: HostNode[];
  parent: HostNode | null;
  props: Record<string, unknown>;
  text: string;
  type: string;
};

function mount(rootComponent: Component, plugin?: GTPlugin) {
  const renderer = createRenderer<HostNode, HostNode>({
    createComment: (text) => createHostNode('comment', text),
    createElement: (type) => createHostNode(type),
    createText: (text) => createHostNode('text', text),
    insert(child, parent, anchor) {
      child.parent = parent;
      const index = anchor ? parent.children.indexOf(anchor) : -1;
      if (index >= 0) parent.children.splice(index, 0, child);
      else parent.children.push(child);
    },
    nextSibling(node) {
      if (!node.parent) return null;
      const index = node.parent.children.indexOf(node);
      return node.parent.children[index + 1] ?? null;
    },
    parentNode: (node) => node.parent,
    patchProp(element, key, _previous, next) {
      element.props[key] = next;
    },
    remove(node) {
      if (!node.parent) return;
      const index = node.parent.children.indexOf(node);
      if (index >= 0) node.parent.children.splice(index, 1);
    },
    setElementText(element, text) {
      element.text = text;
      element.children = [];
    },
    setText(node, text) {
      node.text = text;
    },
  });
  const app = renderer.createApp(rootComponent);
  if (plugin) app.use(plugin);
  const root = createHostNode('root');
  app.mount(root);
  return { app, root };
}

function createHostNode(type: string, text = ''): HostNode {
  return { children: [], parent: null, props: {}, text, type };
}
