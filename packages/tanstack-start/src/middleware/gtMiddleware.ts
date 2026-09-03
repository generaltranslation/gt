import {
  createMiddleware,
  type RequestMiddlewareAfterServer,
} from '@tanstack/react-start';
import { getRequestConditions } from '../functions/requestConditions';

/**
 * Resolve GT conditions before downstream request handlers run.
 *
 * @deprecated Runtime helpers now resolve conditions from TanStack's request
 * context directly. This middleware is retained for backwards compatibility.
 */
export const gtMiddleware: RequestMiddlewareAfterServer<
  {},
  undefined,
  undefined
> = createMiddleware().server(({ request, next }) => {
  getRequestConditions(request);
  return next();
});
