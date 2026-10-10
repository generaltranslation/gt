// What the plugin adds to a Payload config.
import { describe, expect, it } from 'vitest';
import { gtPlugin } from '../plugin';
import { testConfig } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';

describe('gtPlugin config', () => {
  it('adds the Translate button, the Translations page and its endpoints', async () => {
    const config = await testConfig([gtPlugin({ client: new FakeGt() })]);

    expect(config.endpoints.map((e) => e.path)).toEqual(
      expect.arrayContaining(['/gt/runs', '/gt/runs/step', '/gt/coverage'])
    );
    expect(config.admin.components?.views).toHaveProperty('gtTranslations');
    const pages = config.collections.find((c) => c.slug === 'pages');
    expect(pages?.admin.components?.edit?.beforeDocumentControls).toContain(
      'gt-payload/client#GtDocumentControls'
    );
  });

  it('leaves a config without localization as it is', async () => {
    const config = await testConfig([gtPlugin({ client: new FakeGt() })], {
      localization: false,
    });

    expect(config.endpoints.some((e) => e.path.startsWith('/gt/'))).toBe(false);
    expect(config.admin.components?.views ?? {}).not.toHaveProperty(
      'gtTranslations'
    );
  });

  it('passes customMapping to the admin panel', async () => {
    const customMapping = { cn: { code: 'zh' } };
    const config = await testConfig([
      gtPlugin({ client: new FakeGt(), customMapping }),
    ]);

    expect(config.admin.custom).toMatchObject({ gtPayload: { customMapping } });
  });
});
