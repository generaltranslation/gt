import { createNextMiddleware } from 'gt-next/middleware';

const localeRouting = process.env.GT_LOCALE_ROUTING === 'true';
export default createNextMiddleware({
  localeRouting,
  prefixDefaultLocale: process.env.GT_PREFIX_DEFAULT_LOCALE === 'true',
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
