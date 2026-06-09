import { describe, expect, it } from 'vitest';

// gt-react/context resolves to context.server by default, context.client in
// browsers, and context.rsc under the react-server condition. Users should be
// able to import any name from gt-react/context in any runtime, so the
// react-server implementation must mirror the context.server export surface
// exactly.
describe('gt-react/context export parity', () => {
  it('context.rsc mirrors the context.server export surface', async () => {
    const rsc = await import('../context.rsc');
    const server = await import('../context.server');
    expect(Object.keys(rsc).sort()).toEqual(Object.keys(server).sort());
  });
});
