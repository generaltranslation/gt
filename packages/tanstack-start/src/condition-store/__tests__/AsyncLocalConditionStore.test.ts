import { describe, expect, it } from 'vitest';
import { AsyncLocalConditionStore } from '../AsyncLocalConditionStore';

describe('AsyncLocalConditionStore', () => {
  it('reports whether the current execution has a request scope', () => {
    const conditionStore = new AsyncLocalConditionStore();

    expect(conditionStore.hasActiveScope()).toBe(false);
    conditionStore.run(
      { locale: 'fr', region: undefined, enableI18n: true },
      () => expect(conditionStore.hasActiveScope()).toBe(true)
    );
    expect(conditionStore.hasActiveScope()).toBe(false);
  });

  it('isolates conditions between concurrent requests', async () => {
    const conditionStore = new AsyncLocalConditionStore();
    let releaseFirstRequest!: () => void;
    const firstRequestPending = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });

    const firstRequest = conditionStore.run(
      { locale: 'fr', region: 'FR', enableI18n: true },
      async () => {
        await firstRequestPending;
        return {
          locale: conditionStore.getLocale(),
          region: conditionStore.getRegion(),
          enableI18n: conditionStore.getEnableI18n(),
        };
      }
    );

    const secondRequest = conditionStore.run(
      { locale: 'es', region: 'MX', enableI18n: false },
      async () => ({
        locale: conditionStore.getLocale(),
        region: conditionStore.getRegion(),
        enableI18n: conditionStore.getEnableI18n(),
      })
    );

    await expect(secondRequest).resolves.toEqual({
      locale: 'es',
      region: 'MX',
      enableI18n: false,
    });

    releaseFirstRequest();
    await expect(firstRequest).resolves.toEqual({
      locale: 'fr',
      region: 'FR',
      enableI18n: true,
    });
  });

  it('throws when conditions are read outside a request scope', () => {
    const conditionStore = new AsyncLocalConditionStore();

    expect(() => conditionStore.getLocale()).toThrow(
      'Cannot read GT request state outside a request scope'
    );
  });
});
