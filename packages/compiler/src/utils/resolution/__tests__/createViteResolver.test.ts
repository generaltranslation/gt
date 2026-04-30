import { describe, expect, it, vi } from 'vitest';
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import { createViteResolver } from '../createViteResolver';

function createContext(
  overrides: Partial<UnpluginBuildContext & UnpluginContext> = {}
): UnpluginBuildContext & UnpluginContext {
  return {
    addWatchFile: vi.fn(),
    emitFile: vi.fn(),
    getWatchFiles: vi.fn(() => []),
    parse: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    ...overrides,
  };
}

describe('createViteResolver', () => {
  it('warns once per plugin state when the bundler context does not expose resolve()', async () => {
    const firstContext = createContext();
    const secondContext = createContext();
    const firstWarningState = { value: false };
    const secondWarningState = { value: false };

    await expect(
      createViteResolver(firstContext, firstWarningState)('./file')
    ).resolves.toBeNull();
    await expect(
      createViteResolver(secondContext, firstWarningState)('./file')
    ).resolves.toBeNull();
    await expect(
      createViteResolver(secondContext, secondWarningState)('./file')
    ).resolves.toBeNull();

    expect(firstContext.warn).toHaveBeenCalledTimes(1);
    expect(firstContext.warn).toHaveBeenCalledWith(
      '[gt-compiler] Cross-file resolution is enabled, but this bundler context does not expose resolve(). Import lookups will return null.'
    );
    expect(secondContext.warn).toHaveBeenCalledTimes(1);
  });
});
