import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware({
  // Have to prefix since otherwise fumadocs will not work
  prefixDefaultLocale: true,
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next (internal files)
     * - static files
     */
    '/((?!api|static|ingest|.*\\..*|_next).*)',
  ],
};
