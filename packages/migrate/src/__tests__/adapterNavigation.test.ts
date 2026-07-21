import { describe, expect, it } from 'vitest';
import { getAdapter, supportedSourceIds } from '../adapters/index.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import type { SourceAdapter } from '../adapters/types.js';

/**
 * The navigation lane is a single optional member that holds BOTH the detector
 * and the transform, so an adapter can never wire one half without the other
 * (the driver calls `adapter.navigation?.isNavigationFile` and, in the same
 * branch, `adapter.navigation.transformNavigation`). These tests lock that
 * contract: the runtime checks guard every registered adapter, and the
 * type-level check documents that the mispairing no longer compiles.
 */
describe('SourceAdapter navigation pairing', () => {
  it('nextIntlAdapter exposes both navigation halves together', () => {
    expect(nextIntlAdapter.navigation).toBeDefined();
    expect(nextIntlAdapter.navigation?.isNavigationFile).toBeTypeOf('function');
    expect(nextIntlAdapter.navigation?.transformNavigation).toBeTypeOf(
      'function'
    );
  });

  it('navigation is all-or-nothing for every registered adapter', () => {
    // Present => both members present. The single paired object makes a
    // half-wired lane structurally impossible, so this invariant holds for
    // whatever adapters the registry grows to hold.
    const adapters: SourceAdapter[] = supportedSourceIds().map((id) => {
      const adapter = getAdapter(id);
      if (!adapter) throw new Error(`registry lost adapter ${id}`);
      return adapter;
    });
    expect(adapters.length).toBeGreaterThan(0);
    for (const adapter of adapters) {
      if (adapter.navigation === undefined) continue;
      expect(adapter.navigation.isNavigationFile).toBeTypeOf('function');
      expect(adapter.navigation.transformNavigation).toBeTypeOf('function');
    }
  });

  it('rejects a half-wired navigation lane at compile time', () => {
    // Supplying isNavigationFile without transformNavigation (or vice versa) is
    // a type error now that both live in one required-both object. The
    // @ts-expect-error below asserts that; if the pairing regressed to two
    // independent optionals, this directive would become unused and `tsc` would
    // flag it.
    const halfWired: NonNullable<SourceAdapter['navigation']> =
      // @ts-expect-error transformNavigation is required alongside isNavigationFile
      { isNavigationFile: () => true };
    expect(halfWired.isNavigationFile('')).toBe(true);
  });
});
