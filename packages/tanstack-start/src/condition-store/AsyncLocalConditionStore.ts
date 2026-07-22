import { AsyncLocalStorage } from 'node:async_hooks';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { resolveRequestConditions } from '../functions/requestConditions';
import type { InitializeGTParams } from '../types/InitializeGTParams';

export type RequestConditions = {
  locale: string;
  region?: string;
  enableI18n: boolean;
};

const missingRequestScopeError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened: 'Cannot read GT request state outside a request scope',
  why: 'the gt-tanstack-start request middleware has not initialized the ConditionStore for this request',
  fix: "Register gtMiddleware from 'gt-tanstack-start' as global TanStack Start request middleware.",
});

/**
 * Read-only ConditionStore backed by request-scoped AsyncLocalStorage.
 */
export class AsyncLocalConditionStore implements ReadonlyConditionStoreInterface {
  private readonly storage = new AsyncLocalStorage<RequestConditions>();

  constructor(private readonly config: InitializeGTParams) {}

  run<T>(request: Request, callback: () => T, pathname?: string): T {
    const conditions = resolveRequestConditions(request, this.config, pathname);
    return this.storage.run(conditions, callback);
  }

  hasActiveScope(): boolean {
    return this.storage.getStore() !== undefined;
  }

  getLocale = (): string => this.getConditions().locale;

  getRegion = (): string | undefined => this.getConditions().region;

  getEnableI18n = (): boolean => this.getConditions().enableI18n;

  setLocale = (_locale: string): void => {};

  setRegion = (_region: string | undefined): void => {};

  setEnableI18n = (_enableI18n: boolean): void => {};

  private getConditions(): RequestConditions {
    const conditions = this.storage.getStore();
    if (!conditions) throw new Error(missingRequestScopeError);
    return conditions;
  }
}
