import { createMiddleware } from '@tanstack/react-start';
import { AsyncLocalConditionStore } from '../condition-store/AsyncLocalConditionStore';
import {
  getConditionStore,
  isConditionStoreInitialized,
  setConditionStore,
} from '../condition-store/singleton';
import { resolveRequestConditions } from '../functions/requestConditions';

if (!isConditionStoreInitialized()) {
  setConditionStore(new AsyncLocalConditionStore());
}

const conditionStore = getConditionStore();

/**
 * Establish request-scoped GT conditions for SSR, server routes, and server
 * functions.
 */
export const gtMiddleware = createMiddleware().server(({ request, next }) => {
  const conditions = resolveRequestConditions(request);
  return conditionStore.run(conditions, () => next());
});
