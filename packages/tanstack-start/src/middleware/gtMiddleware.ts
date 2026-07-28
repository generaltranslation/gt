import {
  createMiddleware,
  type RequestMiddlewareAfterServer,
} from '@tanstack/react-start';
import { getConditionStore } from '../condition-store/singleton';

/**
 * Establish request-scoped GT conditions for SSR, server routes, and server
 * functions.
 */
export const gtMiddleware: RequestMiddlewareAfterServer<
  {},
  undefined,
  undefined
> = createMiddleware().server(({ request, pathname, next }) => {
  return getConditionStore().run(request, () => next(), pathname);
});
