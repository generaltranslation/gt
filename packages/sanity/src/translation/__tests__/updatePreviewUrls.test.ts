import type { SanityClient } from 'sanity';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createGroqClient } from '../../utils/__tests__/groqClient';

const updateFiles = vi.fn();
const overrideConfig = vi.fn();

vi.mock('../../adapter/core', async () => {
  const actual =
    await vi.importActual<typeof import('../../adapter/core')>(
      '../../adapter/core'
    );
  return {
    ...actual,
    api: { updateFiles: (...args: unknown[]) => updateFiles(...args) },
    overrideConfig: (...args: unknown[]) => overrideConfig(...args),
  };
});

const { updateTranslationPreviewUrls } = await import('../updatePreviewUrls');
const { pluginConfig } = await import('../../adapter/core');

const secrets = { organization: 'org', project: 'project', secret: 'key' };

// Document-level translations are separate documents with their own slugs, still drafts right after import.
const dataset = [
  { _id: 'drafts.pricing-es', _type: 'page', slug: { current: 'precios' } },
  { _id: 'drafts.pricing-fr', _type: 'page', slug: { current: 'tarifs' } },
];

const imported = (id: string, language: string) => ({
  written: { id, type: 'page' },
  file: { branchId: 'branch', fileId: 'pricing', versionId: 'r1' },
  language,
});

beforeEach(() => {
  updateFiles.mockReset();
  updateFiles.mockResolvedValue({ files: [] });
  overrideConfig.mockReset();
  vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue({
    origin: 'https://staging.acme.test',
    locations: {
      page: {
        select: { slug: 'slug.current' },
        resolve: (doc, { language }) =>
          doc && {
            locations: [
              {
                title: 'Page',
                href: `/${language.slice(0, 2)}/${String(doc.slug)}`,
              },
            ],
          },
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('updateTranslationPreviewUrls', () => {
  test("stores each translation's page, read from its written draft in its language", async () => {
    const failures = await updateTranslationPreviewUrls(
      [imported('pricing-es', 'es-ES'), imported('pricing-fr', 'fr-FR')],
      createGroqClient(dataset).client as SanityClient,
      secrets
    );

    expect(failures).toEqual([]);
    expect(overrideConfig).toHaveBeenCalledWith(secrets);
    expect(updateFiles).toHaveBeenCalledWith([
      {
        branchId: 'branch',
        fileId: 'pricing',
        versionId: 'r1',
        locale: 'es-ES',
        metadata: { previewUrl: 'https://staging.acme.test/es/precios' },
      },
      {
        branchId: 'branch',
        fileId: 'pricing',
        versionId: 'r1',
        locale: 'fr-FR',
        metadata: { previewUrl: 'https://staging.acme.test/fr/tarifs' },
      },
    ]);
  });

  test('sends only the translations that have a page', async () => {
    await updateTranslationPreviewUrls(
      [imported('pricing-es', 'es-ES'), imported('missing', 'de-DE')],
      createGroqClient(dataset).client as SanityClient,
      secrets
    );

    expect(updateFiles).toHaveBeenCalledWith([
      expect.objectContaining({ locale: 'es-ES' }),
    ]);
  });

  test('sends nothing when the plugin has no previewUrl', async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue(null);

    const failures = await updateTranslationPreviewUrls(
      [imported('pricing-es', 'es-ES')],
      createGroqClient(dataset).client as SanityClient,
      secrets
    );

    expect(failures).toEqual([]);
    expect(updateFiles).not.toHaveBeenCalled();
  });

  test('returns a failed update instead of throwing, so the import stands', async () => {
    const rejected = new Error('API unavailable');
    updateFiles.mockRejectedValue(rejected);

    await expect(
      updateTranslationPreviewUrls(
        [imported('pricing-es', 'es-ES')],
        createGroqClient(dataset).client as SanityClient,
        secrets
      )
    ).resolves.toEqual([rejected]);
  });
});
