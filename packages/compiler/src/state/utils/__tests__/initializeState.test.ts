import { describe, expect, it } from 'vitest';
import { initializeState } from '../initializeState';

const gtConfigWithAutoJsxInjection = (enableAutoJsxInjection: boolean) => ({
  files: { gt: { parsingFlags: { enableAutoJsxInjection } } },
});

describe('initializeState enableAutoJsxInjection precedence', () => {
  it('defaults to false', () => {
    expect(initializeState({}, 'a.tsx').settings.enableAutoJsxInjection).toBe(
      false
    );
  });

  it('reads gt.config.json parsingFlags when the option is absent', () => {
    const state = initializeState(
      { gtConfig: gtConfigWithAutoJsxInjection(true) },
      'a.tsx'
    );
    expect(state.settings.enableAutoJsxInjection).toBe(true);
  });

  it('lets the plugin option override parsingFlags', () => {
    expect(
      initializeState(
        {
          enableAutoJsxInjection: false,
          gtConfig: gtConfigWithAutoJsxInjection(true),
        },
        'a.tsx'
      ).settings.enableAutoJsxInjection
    ).toBe(false);
    expect(
      initializeState(
        {
          enableAutoJsxInjection: true,
          gtConfig: gtConfigWithAutoJsxInjection(false),
        },
        'a.tsx'
      ).settings.enableAutoJsxInjection
    ).toBe(true);
  });
});
