import { createNextMiddleware } from 'gt-next/middleware';
import { NextResponse } from 'next/server';

const dynamicOwnership = {
  '/[category]': { en: '/[category]', fr: '/[category]' },
  '/fr/[id]': { en: '/fr/[id]', fr: '/other/[id]' },
};
const configurations = {
  encoded: {
    '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
    '/[category]/articles/[id]': { en: '/[category]/articles/[id]' },
  },
  home: { '/fr': { en: '/fr', fr: '/other' } },
  dynamic: dynamicOwnership,
  reverse: Object.fromEntries(Object.entries(dynamicOwnership).reverse()),
  depth: {
    '/short/[a]/[b]': {
      en: '/short/[a]/[b]',
      fr: '/long/static/[first]/[second]',
    },
  },
  unprefixed: {
    '/short/[a]/[b]': {
      en: '/long/static/[first]/[second]',
      fr: '/autre/[first]/[second]',
    },
  },
  catchall: {
    '/catalog/[category]/[...slug]/': {
      en: '/catalog/[category]/[...slug]/',
      fr: '/catalogue/[category]/[...slug]/',
    },
  },
};

const handlers = Object.fromEntries(
  Object.entries(configurations).map(([name, pathConfig]) => [
    name,
    [false, true].map((prefixDefaultLocale) =>
      createNextMiddleware({ pathConfig, prefixDefaultLocale })
    ),
  ])
);

type MiddlewareRequest = Parameters<ReturnType<typeof createNextMiddleware>>[0];

export default function middleware(request: MiddlewareRequest) {
  const scenario = request.nextUrl.searchParams.get('scenario') || 'encoded';
  if (scenario === 'native') return NextResponse.next();
  const prefix = request.nextUrl.searchParams.get('prefix') === '0' ? 0 : 1;
  return (handlers[scenario] || handlers.encoded)[prefix](request);
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
