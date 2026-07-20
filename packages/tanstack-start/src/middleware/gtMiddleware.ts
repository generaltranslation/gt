import { createMiddleware } from '@tanstack/react-start';
import { getConditionStore } from '../condition-store/singleton';
import { resolveRequestConditions } from '../functions/requestConditions';

/**
 * Establish request-scoped GT conditions for SSR, server routes, and server
 * functions.
 */
export const gtMiddleware = createMiddleware().server(({ request, next }) => {
  const conditions = resolveRequestConditions(request);
  return getConditionStore().run(conditions, () => next());
});
