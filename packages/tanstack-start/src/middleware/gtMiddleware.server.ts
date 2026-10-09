import {
  createMiddleware,
  type RequestMiddlewareAfterServer,
} from '@tanstack/react-start';
import { getServerConditionStore } from '../setup/initializeGT.server';

/**
 * Establish request-scoped GT conditions for SSR, server routes, and server
 * functions.
 *
 * @deprecated No longer needed: GT resolves each request's locale from
 * TanStack Start's request context. Remove it from `requestMiddleware`.
 */
export const gtMiddleware: RequestMiddlewareAfterServer<
  {},
  undefined,
  undefined
> = createMiddleware().server(({ request, pathname, next }) => {
  return getServerConditionStore().run(request, () => next(), pathname);
});
