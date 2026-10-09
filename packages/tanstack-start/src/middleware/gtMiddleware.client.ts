import {
  createMiddleware,
  type RequestMiddlewareAfterServer,
} from '@tanstack/react-start';

// Request middleware only runs on the server, so the browser entry passes
// through. This keeps the server condition store and its node:async_hooks
// import out of the browser entry.
/**
 * @deprecated No longer needed: GT resolves each request's locale from
 * TanStack Start's request context. Remove it from `requestMiddleware`.
 */
export const gtMiddleware: RequestMiddlewareAfterServer<
  {},
  undefined,
  undefined
> = createMiddleware().server(({ next }) => next());
