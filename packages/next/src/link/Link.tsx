'use client';

import NextLink from 'next/link';
import { forwardRef, type ComponentProps, type ComponentRef } from 'react';
import { useLocalizeHref } from './useLocalizeHref';

type LinkRef = ComponentRef<typeof NextLink>;

export type LinkProps = ComponentProps<typeof NextLink>;

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
 * so Link can read them. Use `useLocalizeHref()` to localize hrefs outside Link.
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
  const localizeHref = useLocalizeHref();
  return <NextLink {...props} href={localizeHref(href, locale)} ref={ref} />;
});
