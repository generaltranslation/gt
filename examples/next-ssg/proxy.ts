import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware();

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next).*)'],
};