import React, { AnchorHTMLAttributes } from 'react';
import useGTContext from '../provider/GTContext';
import { processHref } from './utils';

/**
 * Props for the Link component
 */
export type LinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> & {
  /** The destination URL or path. Use {locale} placeholder to insert locale at a specific position. */
  href: string;
  /** Override the current locale for this link */
  locale?: string;
  /** Link content */
  children?: React.ReactNode;
};

/**
 * A locale-aware Link component that automatically includes the current locale in URLs.
 *
 * @example
 * // Basic usage - locale is prepended automatically
 * <Link href="/about">About</Link>
 * // Renders as: <a href="/en/about">About</a>
 *
 * @example
 * // Using {locale} placeholder for custom positioning
 * <Link href="/my/{locale}/dashboard">Dashboard</Link>
 * // Renders as: <a href="/my/en/dashboard">Dashboard</a>
 *
 * @example
 * // External URLs with {locale} placeholder
 * <Link href="https://docs.example.com/{locale}/guide">Docs</Link>
 * // Renders as: <a href="https://docs.example.com/en/guide">Docs</a>
 *
 * @example
 * // Override locale for specific link
 * <Link href="/about" locale="fr">French About</Link>
 * // Renders as: <a href="/fr/about">French About</a>
 *
 * @example
 * // External URLs without placeholder pass through unchanged
 * <Link href="https://google.com">Google</Link>
 * // Renders as: <a href="https://google.com">Google</a>
 */
export default function Link({
  href,
  locale: localeOverride,
  children,
  ...props
}: LinkProps): React.ReactElement {
  const { locale, defaultLocale, hideDefaultLocale } = useGTContext(
    'Link: Unable to access locale outside of a <GTProvider>'
  );

  const effectiveLocale = localeOverride ?? locale;
  const processedHref = processHref(
    href,
    effectiveLocale,
    defaultLocale,
    hideDefaultLocale
  );

  return (
    <a href={processedHref} {...props}>
      {children}
    </a>
  );
}
