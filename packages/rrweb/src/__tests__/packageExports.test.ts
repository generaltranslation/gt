import { describe, expect, it } from 'vitest';

// Smoke test for the package entry. The scaffold exports nothing yet; this just
// asserts the module loads. Real export assertions land with the public API.
describe('gt-rrweb', () => {
  it('loads its entry point', async () => {
    const mod = await import('../index');
    expect(mod).toBeTypeOf('object');
  });
});
