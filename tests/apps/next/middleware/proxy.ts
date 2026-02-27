import { createNextMiddleware } from 'gt-next/middleware';

const useCase = process.env.NEXT_PUBLIC_USE_CASE || 'main';

function getConfig() {
  switch (useCase) {
    case 'prefix-default':
      return { prefixDefaultLocale: true };

    case 'path-config':
      return {
        prefixDefaultLocale: false,
        pathConfig: {
          '/about': {
            en: '/about-us',
            fr: '/a-propos',
            es: '/acerca-de',
          },
        },
      };

    case 'no-routing':
      return { localeRouting: false };

    case 'main':
    default:
      return { prefixDefaultLocale: false };
  }
}

export default createNextMiddleware(getConfig());

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next).*)'],
};
