import { describe, expect, it, vi } from 'vitest';
import { resolveRequestFunction } from '../resolveRequestFunction';

describe('resolveRequestFunction', () => {
  it('accepts direct, default, and named request functions', () => {
    const direct = vi.fn();
    const defaultExport = vi.fn();
    const namedExport = vi.fn();

    expect(resolveRequestFunction(direct, 'getLocale', 'warning')).toBe(direct);
    expect(
      resolveRequestFunction({ default: defaultExport }, 'getLocale', 'warning')
    ).toBe(defaultExport);
    expect(
      resolveRequestFunction(
        { default: 'not a function', getLocale: namedExport },
        'getLocale',
        'warning'
      )
    ).toBe(namedExport);
  });

  it('warns when the configured module has no request function', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveRequestFunction({}, 'getLocale', 'warning')).toBeUndefined();
    expect(consoleWarn).toHaveBeenCalledWith('warning');

    consoleWarn.mockRestore();
  });
});
