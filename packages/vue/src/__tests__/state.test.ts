import {
  createRenderer,
  defineComponent,
  h,
  nextTick,
  ref,
  type Component,
} from 'vue';
import { hashSource } from 'generaltranslation/id';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Num, Plural, createGT, useGT, useLocale } from '../index';
import type { GTPlugin, TranslationCatalog } from '../index';

describe('gt-vue runtime state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects failed locale changes, preserves the locale, and retries', async () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=en'
    );
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
    expect(cookieDocument.get('generaltranslation.locale')).toBe('en');
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

  it('uses a browser cookie before the default locale and persists it', () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=fr'
    );

    const firstPlugin = createGT({ defaultLocale: 'en' });
    expect(firstPlugin.getLocale()).toBe('fr');

    cookieDocument.cookie = 'generaltranslation.locale=es;path=/';
    const secondPlugin = createGT({ defaultLocale: 'en' });
    expect(secondPlugin.getLocale()).toBe('es');
  });

  it('persists the default locale when the browser has no locale cookie', () => {
    const cookieDocument = installCookieDocument();

    const plugin = createGT({ defaultLocale: 'en' });

    expect(plugin.getLocale()).toBe('en');
    expect(cookieDocument.get('generaltranslation.locale')).toBe('en');
  });

  it('falls back instead of retaining client state when the cookie is removed', async () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=fr'
    );
    const plugin = createGT({ defaultLocale: 'en' });

    expect(plugin.getLocale()).toBe('fr');
    cookieDocument.delete('generaltranslation.locale');
    expect(plugin.getLocale()).toBe('en');

    await plugin.setLocale('de');
    expect(plugin.getLocale()).toBe('de');
    cookieDocument.delete('generaltranslation.locale');
    expect(plugin.getLocale()).toBe('en');
  });

  it('uses an explicit hydration locale before a stale browser cookie', () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=fr'
    );

    const plugin = createGT({ defaultLocale: 'en', locale: 'de' });

    expect(plugin.getLocale()).toBe('de');
    expect(cookieDocument.get('generaltranslation.locale')).toBe('de');
  });

  it('supports a custom locale cookie name', async () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=fr; custom-locale=es'
    );
    const plugin = createGT({ localeCookieName: 'custom-locale' });

    expect(plugin.getLocale()).toBe('es');
    await plugin.setLocale('de');

    expect(cookieDocument.get('custom-locale')).toBe('de');
    expect(cookieDocument.get('generaltranslation.locale')).toBe('fr');
  });

  it('writes a loaded locale to the cookie and rerenders consumers', async () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=en'
    );
    let resolveCatalog!: (catalog: TranslationCatalog) => void;
    const loadTranslations = vi.fn(
      () =>
        new Promise<TranslationCatalog>((resolve) => {
          resolveCatalog = resolve;
        })
    );
    const plugin = createGT({ loadTranslations });
    const Root = defineComponent({
      setup() {
        const locale = useLocale();
        return () => h('p', locale.value);
      },
    });
    const mounted = mount(Root, plugin);
    cookieDocument.writes.length = 0;

    const switching = plugin.setLocale('fr');
    await vi.waitFor(() => expect(loadTranslations).toHaveBeenCalledOnce());

    expect(plugin.getLocale()).toBe('en');
    expect(textContent(mounted.root)).toBe('en');
    expect(cookieDocument.writes).toEqual([]);

    resolveCatalog({});
    await switching;
    await nextTick();

    expect(plugin.getLocale()).toBe('fr');
    expect(textContent(mounted.root)).toBe('fr');
    expect(cookieDocument.writes).toEqual([
      'generaltranslation.locale=fr;path=/',
    ]);
    mounted.app.unmount();
  });

  it('reactively formats custom aliases while preserving loader and cookie values', async () => {
    const cookieDocument = installCookieDocument();
    const loadTranslations = vi.fn(async () => ({}));
    const plugin = createGT({
      customMapping: {
        pirate: { code: 'fr-FR' },
        source: { code: 'en-US' },
      },
      defaultLocale: 'source',
      loadTranslations,
    });
    const Root = defineComponent({
      setup() {
        const locale = useLocale();
        const pluralSlots = {
          one: () => 'one',
          other: () => 'other',
        };
        return () =>
          h('p', [
            `${locale.value}|`,
            h(Num, { value: 1234.5 }),
            '|',
            h(Plural, { n: 0 }, pluralSlots),
          ]);
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe(
      `source|${new Intl.NumberFormat('en-US').format(1234.5)}|other`
    );
    expect(cookieDocument.get('generaltranslation.locale')).toBe('source');

    await plugin.setLocale('pirate');
    await nextTick();

    expect(textContent(mounted.root)).toBe(
      `pirate|${new Intl.NumberFormat('fr-FR').format(1234.5)}|one`
    );
    expect(loadTranslations).toHaveBeenCalledOnce();
    expect(loadTranslations).toHaveBeenCalledWith('pirate');
    expect(cookieDocument.get('generaltranslation.locale')).toBe('pirate');
    mounted.app.unmount();
  });

  it('keeps the cookie aligned with the latest concurrent locale request', async () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=en'
    );
    const pending = new Map<string, (catalog: TranslationCatalog) => void>();
    const plugin = createGT({
      loadTranslations: (locale) =>
        new Promise((resolve) => pending.set(locale, resolve)),
    });

    const french = plugin.setLocale('fr');
    const chinese = plugin.setLocale('zh');
    await vi.waitFor(() => expect(pending.size).toBe(2));

    pending.get('zh')?.({});
    await chinese;
    expect(cookieDocument.get('generaltranslation.locale')).toBe('zh');

    pending.get('fr')?.({});
    await french;
    expect(plugin.getLocale()).toBe('zh');
    expect(cookieDocument.get('generaltranslation.locale')).toBe('zh');
  });

  it('reads an external cookie write and rerenders when setLocale is called', async () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=en'
    );
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        const locale = useLocale();
        return () => h('p', locale.value);
      },
    });
    const mounted = mount(Root, plugin);

    cookieDocument.cookie = 'generaltranslation.locale=fr;path=/';

    expect(plugin.getLocale()).toBe('fr');
    expect(textContent(mounted.root)).toBe('en');

    await plugin.setLocale('fr');
    await nextTick();

    expect(textContent(mounted.root)).toBe('fr');
    mounted.app.unmount();
  });

  it('keeps useLocale and translations aligned on unrelated rerenders', async () => {
    const cookieDocument = installCookieDocument(
      'generaltranslation.locale=en'
    );
    const source = 'Hello';
    const plugin = createGT({
      loadTranslations: async (locale) =>
        locale === 'fr'
          ? {
              [hashSource({
                dataFormat: 'STRING',
                source,
              })]: 'Bonjour',
            }
          : {},
    });
    await plugin.loadTranslations('fr');
    const counter = ref(0);
    const Root = defineComponent({
      setup() {
        const gt = useGT();
        const locale = useLocale();
        return () => h('p', `${locale.value}|${gt(source)}|${counter.value}`);
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('en|Hello|0');
    cookieDocument.cookie = 'generaltranslation.locale=fr;path=/';
    counter.value += 1;
    await nextTick();

    expect(textContent(mounted.root)).toBe('fr|Bonjour|1');
    mounted.app.unmount();
  });

  it('uses the explicit locale without browser globals during SSR', async () => {
    const plugin = createGT({
      locale: 'fr',
      loadTranslations: async () => ({}),
    });

    expect(plugin.getLocale()).toBe('fr');
    await plugin.setLocale('de');
    expect(plugin.getLocale()).toBe('de');
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

    expect(() => mount(Root)).toThrow(
      'Install the exact plugin returned by initializeGTSPA()'
    );
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

function textContent(node: HostNode): string {
  return node.text + node.children.map(textContent).join('');
}

class TestCookieDocument {
  readonly writes: string[] = [];
  private readonly values = new Map<string, string>();

  constructor(cookieHeader = '') {
    for (const cookie of cookieHeader.split(';')) {
      const separator = cookie.indexOf('=');
      if (separator < 0) continue;
      this.values.set(
        cookie.slice(0, separator).trim(),
        cookie.slice(separator + 1).trim()
      );
    }
  }

  get cookie(): string {
    return [...this.values]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  set cookie(serializedCookie: string) {
    this.writes.push(serializedCookie);
    const [cookie = ''] = serializedCookie.split(';');
    const separator = cookie.indexOf('=');
    if (separator < 0) return;
    this.values.set(
      cookie.slice(0, separator).trim(),
      cookie.slice(separator + 1).trim()
    );
  }

  get(cookieName: string): string | undefined {
    return this.values.get(cookieName);
  }

  delete(cookieName: string): void {
    this.values.delete(cookieName);
  }
}

function installCookieDocument(cookieHeader = ''): TestCookieDocument {
  const cookieDocument = new TestCookieDocument(cookieHeader);
  vi.stubGlobal('document', cookieDocument);
  return cookieDocument;
}
