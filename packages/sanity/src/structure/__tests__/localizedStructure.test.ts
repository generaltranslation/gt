import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StructureBuilder } from 'sanity/structure';
import { pluginConfig } from '../../adapter/core';
import { gtStructureItems } from '../localizedStructure';

/**
 * Records what the structure builder was asked to create. Each builder method
 * returns a chainable stub whose calls are captured on a plain object, so the
 * assertions below read the resulting tree rather than the call sequence.
 */
type Node = Record<string, unknown>;

function createBuilderSpy() {
  const chain = (kind: string): Node => {
    const node: Node = { kind };
    const proxy = new Proxy(node, {
      get(target, prop: string) {
        if (prop === '__node') return target;
        return (value: unknown) => {
          target[prop] =
            value && typeof value === 'object' && '__node' in (value as Node)
              ? (value as { __node: Node }).__node
              : value;
          return proxy;
        };
      },
    });
    return proxy as unknown as Node;
  };

  const S = {
    listItem: () => chain('listItem'),
    list: () => chain('list'),
    documentList: () => chain('documentList'),
    divider: () => ({ __node: { kind: 'divider' } }),
  } as unknown as StructureBuilder;

  return S;
}

const unwrap = (value: unknown): Node =>
  (value as { __node?: Node }).__node ?? (value as Node);

describe('gtStructureItems', () => {
  beforeEach(() => {
    vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en-US');
    vi.spyOn(pluginConfig, 'getLocales').mockReturnValue(['ja-JP', 'fr-FR']);
    vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
    vi.spyOn(pluginConfig, 'getTranslationLevel').mockReturnValue('document');
    vi.spyOn(pluginConfig, 'getTranslateDocuments').mockReturnValue([
      { type: 'landingPage' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates one item per translatable type', () => {
    const items = gtStructureItems(createBuilderSpy()).map(unwrap);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('gt-landingPage');
    expect(items[0].title).toBe('landingPage');
  });

  it('gives each target locale its own pane, plus the source', () => {
    const [item] = gtStructureItems(createBuilderSpy()).map(unwrap);
    const locales = (unwrap(item.child).items as Node[]).map(unwrap);

    expect(locales.map((pane) => pane.id)).toEqual([
      'gt-landingPage-en-US',
      undefined, // divider
      'gt-landingPage-ja-JP',
      'gt-landingPage-fr-FR',
    ]);
    // Same label helper the plugin gives @sanity/document-internationalization,
    // so a locale reads identically wherever it appears in the Studio.
    expect(locales[2].title).toContain('Japanese');
    expect(locales[2].title).toContain('ja-JP');
    expect(locales[2].title).toMatch(/^landingPage in /);
  });

  it('treats a document with no language field as the source', () => {
    const [item] = gtStructureItems(createBuilderSpy()).map(unwrap);
    const locales = (unwrap(item.child).items as Node[]).map(unwrap);
    const sourceList = unwrap(locales[0].child);

    expect(sourceList.filter).toBe(
      '_type == $type && (!defined(language) || language == $locale)'
    );
    expect(sourceList.params).toEqual({
      type: 'landingPage',
      locale: 'en-US',
    });
  });

  it('filters a target pane to that locale only', () => {
    const [item] = gtStructureItems(createBuilderSpy()).map(unwrap);
    const locales = (unwrap(item.child).items as Node[]).map(unwrap);
    const japanese = unwrap(locales[2].child);

    expect(japanese.filter).toBe('_type == $type && language == $locale');
    expect(japanese.params).toEqual({ type: 'landingPage', locale: 'ja-JP' });
    expect(japanese.schemaType).toBe('landingPage');
  });

  it('honors a custom language field', () => {
    vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('lang');

    const [item] = gtStructureItems(createBuilderSpy()).map(unwrap);
    const locales = (unwrap(item.child).items as Node[]).map(unwrap);

    expect(unwrap(locales[2].child).filter).toBe(
      '_type == $type && lang == $locale'
    );
  });

  it('omits types localized in place, which have no per-locale documents', () => {
    vi.spyOn(pluginConfig, 'getTranslationLevel').mockReturnValue('mixed');
    vi.spyOn(pluginConfig, 'getTranslateDocuments').mockReturnValue([
      { type: 'landingPage' },
      { type: 'banner' },
    ]);
    vi.spyOn(pluginConfig, 'getFieldLevelDocuments').mockReturnValue([
      { type: 'banner' },
    ]);

    const items = gtStructureItems(createBuilderSpy()).map(unwrap);

    expect(items.map((item) => item.id)).toEqual(['gt-landingPage']);
  });

  it('returns nothing when no types are configured', () => {
    vi.spyOn(pluginConfig, 'getTranslateDocuments').mockReturnValue([]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(gtStructureItems(createBuilderSpy())).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('accepts an explicit type list', () => {
    const items = gtStructureItems(createBuilderSpy(), undefined, {
      types: ['post'],
    }).map(unwrap);

    expect(items.map((item) => item.id)).toEqual(['gt-post']);
  });
});
