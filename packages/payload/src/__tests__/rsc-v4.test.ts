import { expect, it, vi } from 'vitest';

const { template, createView } = vi.hoisted(() => ({
  template: () => null,
  createView: vi.fn((component: unknown) => component),
}));

vi.mock('@payloadcms/ui/rsc', () => ({ DefaultTemplate: template }));
vi.mock('../rsc/createTranslationsView', () => ({
  createTranslationsView: createView,
}));

it('loads the v4 view using the UI template without importing the v3 template path', async () => {
  vi.mock('@payloadcms/next/templates', () => {
    throw new Error('The templates subpath does not exist in Payload v4');
  });
  const { GtTranslationsView } = await import('../rsc-v4');
  expect(createView).toHaveBeenCalledWith(template);
  expect(GtTranslationsView).toBe(template);
});
