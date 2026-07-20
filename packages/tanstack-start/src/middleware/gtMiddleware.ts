import { createMiddleware } from '@tanstack/react-start';
import { getConditionStore } from '../condition-store/singleton';

/**
 * Establish request-scoped GT conditions for SSR, server routes, and server
 * functions.
 */
export const gtMiddleware = createMiddleware().server(({ request, next }) => {
  return getConditionStore().run(request, () => next());
});
