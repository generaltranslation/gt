import { getRequest } from '@tanstack/react-start/server';
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
  why: 'this code is running outside a TanStack Start server request',
  fix: 'Call GT server functions from route loaders, server functions, server routes, or components rendered during SSR.',
});

/**
 * Read-only ConditionStore that resolves each TanStack Start request's
 * conditions once, from Start's own request context.
 */
export class AsyncLocalConditionStore implements ReadonlyConditionStoreInterface {
  private readonly requestConditions = new WeakMap<
    Request,
    RequestConditions
  >();

  constructor(private readonly config: InitializeGTParams) {}

  isLocaleRoutingEnabled(): boolean {
    return this.config.localeRouting === true;
  }

  getLocale = (): string => this.getConditions().locale;

  getRegion = (): string | undefined => this.getConditions().region;

  getEnableI18n = (): boolean => this.getConditions().enableI18n;

  setLocale = (_locale: string): void => {};

  setRegion = (_region: string | undefined): void => {};

  setEnableI18n = (_enableI18n: boolean): void => {};

  private getConditions(): RequestConditions {
    // Resolving writes the locale cookie, which only reaches the browser if
    // this first read happens before Start sends the response headers (for
    // example in a route loader, not in streamed content).
    let request: Request;
    try {
      request = getRequest();
    } catch {
      throw new Error(missingRequestScopeError);
    }
    let conditions = this.requestConditions.get(request);
    if (!conditions) {
      conditions = resolveRequestConditions(request, this.config);
      this.requestConditions.set(request, conditions);
    }
    return conditions;
  }
}
