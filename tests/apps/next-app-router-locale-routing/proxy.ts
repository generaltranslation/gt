import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware();
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
