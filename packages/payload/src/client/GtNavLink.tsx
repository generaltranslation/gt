'use client';
import { useConfig } from '@payloadcms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const VIEW_PATH = '/translations';

// A link to the Translations page in the admin nav.
export function GtNavLink() {
  const { config } = useConfig();
  const pathname = usePathname();
  const href = `${config.routes.admin}${VIEW_PATH}`;
  return (
    <Link
      className={`nav__link${pathname === href ? ' active' : ''}`}
      href={href}
      id='nav-translations'
    >
      <span className='nav__link-label'>Translations</span>
    </Link>
  );
}
