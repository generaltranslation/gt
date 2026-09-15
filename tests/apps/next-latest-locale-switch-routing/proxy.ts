import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware({
  localeRoutes: {
    'en-gb': ['/allowed'],
  },
  prefixDefaultLocale: process.env.GT_PREFIX_DEFAULT_LOCALE === 'true',
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
