import type { Config } from 'payload';
import { describe, expect, it } from 'vitest';

import { gtPayload } from '../index';

const baseConfig = (): Config =>
  ({
    collections: [
      {
        slug: 'posts',
        fields: [
          { localized: true, name: 'title', type: 'text' },
          { name: 'internalNote', type: 'text' },
        ],
      },
    ],
    localization: {
      defaultLocale: 'en',
      fallback: true,
      locales: [
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Spanish' },
      ],
    },
  }) as unknown as Config;

describe('gtPayload', () => {
  it('requires localization in the config', () => {
    const config = baseConfig();
    delete (config as { localization?: unknown }).localization;
    expect(() =>
      gtPayload({ collections: { posts: ['title'] } })(config)
    ).toThrow(/localization/);
  });

  it('rejects a field that is not localized', () => {
    expect(() =>
      gtPayload({ collections: { posts: ['internalNote'] } })(baseConfig())
    ).toThrow(/localized: true/);
  });

  it('rejects a field missing from the collection', () => {
    expect(() =>
      gtPayload({ collections: { posts: ['absent'] } })(baseConfig())
    ).toThrow(/not a top-level field/);
  });

  it('registers the endpoint and button on a valid collection', () => {
    const config = gtPayload({ collections: { posts: ['title'] } })(
      baseConfig()
    );
    const posts = config.collections![0];
    const endpoints = posts.endpoints as { method: string; path: string }[];
    expect(
      endpoints.map((endpoint) => [endpoint.method, endpoint.path])
    ).toEqual([['post', '/:id/gt-translate']]);
    expect(posts.admin?.components?.edit?.beforeDocumentControls).toEqual([
      'gt-payload/client#TranslateButton',
    ]);
  });
});
