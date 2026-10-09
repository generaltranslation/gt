import {
  createMiddleware,
  type RequestMiddlewareAfterServer,
} from '@tanstack/react-start';
import { getServerConditionStore } from '../setup/initializeGT.server';

/**
 * Establish request-scoped GT conditions for SSR, server routes, and server
 * functions.
 */
export const gtMiddleware: RequestMiddlewareAfterServer<
  {},
  undefined,
  undefined
> = createMiddleware().server(({ request, pathname, next }) => {
  return getServerConditionStore().run(request, () => next(), pathname);
});
