'use client';

import NextLink from 'next/link';
import {
  forwardRef,
  type ComponentProps,
  type ComponentRef,
  type ForwardedRef,
} from 'react';
import { useDefaultLocale, useLocale } from 'gt-react';
import { resolveMiddlewareConfig } from '../middleware-dir/resolveMiddlewareConfig';

type NextLinkProps = ComponentProps<typeof NextLink>;
type LinkRef = ComponentRef<typeof NextLink>;
type LinkHref = NextLinkProps['href'];

export type LinkProps = NextLinkProps;

type ResolvedLinkProps = Omit<LinkProps, 'locale'> & {
  locale: NonNullable<LinkProps['locale']>;
};

let routingConfig: ReturnType<typeof resolveMiddlewareConfig> | undefined;

/**
 * Reads the routing options passed to withGTConfig() on first use, so
 * importing Link does no work.
 */
function getRoutingConfig() {
  routingConfig ??= resolveMiddlewareConfig();
  return routingConfig;
}

/**
 * Returns whether the middleware would redirect an unprefixed path for `locale`.
 * Unprefixed default-locale paths are rewritten internally unless
 * `prefixDefaultLocale` is set. An explicit default-locale switch keeps its
 * prefix while smart routing would otherwise route to the locale cookie.
 */
function shouldPrefixLocale(
  locale: string,
  defaultLocale: string,
  isExplicitLocale: boolean
): boolean {
  const { prefixDefaultLocale, enableSmartRouting } = getRoutingConfig();
  if (prefixDefaultLocale || locale !== defaultLocale) return true;
  return isExplicitLocale && enableSmartRouting;
}

const LinkWithLocale = forwardRef<LinkRef, Omit<LinkProps, 'locale'>>(
  function LinkWithLocale({ href, ...props }, ref) {
    const locale = useLocale();
    const defaultLocale = useDefaultLocale();
    return renderLink(
      {
        ...props,
        href,
        locale: shouldPrefixLocale(locale, defaultLocale, false)
          ? locale
          : false,
      },
      ref
    );
  }
);

/**
 * Locale-aware wrapper around Next.js's `<Link>` component.
 *
 * Internal hrefs are prefixed with the current GT locale by default. Pass a
 * locale string to use a specific locale, or pass `locale={false}` to leave the
 * href unchanged. External URLs are never prefixed.
 *
 * With `prefixDefaultLocale: false` (the default), current default-locale links
 * are left unprefixed. Explicit default-locale links are left unprefixed only
 * when `enableSmartRouting` is `false`. Set these options in `withGTConfig()`
 * so Link can read them.
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function Navigation() {
 *   return <Link href="/home">Home</Link>; // /fr/home, or /home for the default locale
 * }
 * ```
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function LocaleSwitcher() {
 *   return <Link href="/home" locale="fr">French</Link>; // /fr/home
 * }
 * ```
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function UnlocalizedLink() {
 *   return <Link href="/legal" locale={false}>Legal</Link>; // /legal
 * }
 * ```
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function ExternalLink() {
 *   return <Link href="https://example.com">Example</Link>; // https://example.com
 * }
 * ```
 *
 * @see https://nextjs.org/docs/app/api-reference/components/link
 * @param href - The destination URL or URL object. Internal paths are localized.
 * @param locale - Locale to prefix, or `false` to disable GT locale prefixing.
 * @returns The rendered Next.js link.
 */
export const Link = forwardRef<LinkRef, LinkProps>(function Link(
  { href, locale, ...props },
  ref
) {
  const defaultLocale = useDefaultLocale();

  if (locale === undefined) {
    return <LinkWithLocale {...props} href={href} ref={ref} />;
  }

  return renderLink(
    {
      ...props,
      href,
      locale:
        locale && shouldPrefixLocale(locale, defaultLocale, true)
          ? locale
          : false,
    },
    ref
  );
});

function renderLink(
  { href, locale, ...props }: ResolvedLinkProps,
  ref: ForwardedRef<LinkRef>
) {
  return <NextLink {...props} href={localizeHref(href, locale)} ref={ref} />;
}

function localizeHref(href: LinkHref, locale: LinkProps['locale']): LinkHref {
  if (!locale) return href;

  if (typeof href === 'string') {
    return localizePath(href, locale);
  }

  if (typeof href.pathname !== 'string') return href;

  const localizedPathname = localizePath(href.pathname, locale);
  if (localizedPathname === href.pathname) return href;

  return {
    ...href,
    pathname: localizedPathname,
  };
}

function localizePath(href: string, locale: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  const url = new URL(href, 'http://localhost');
  url.pathname =
    url.pathname === '/'
      ? `/${encodeURIComponent(locale)}`
      : `/${encodeURIComponent(locale)}${url.pathname}`;

  return `${url.pathname}${url.search}${url.hash}`;
}
