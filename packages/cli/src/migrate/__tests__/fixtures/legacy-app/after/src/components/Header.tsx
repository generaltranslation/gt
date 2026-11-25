'use client';

import { T } from 'gt-next';
import { useGT, useMessages } from 'gt-next/unstable';
import { navLinks } from '../lib/messages';

export function Header() {
  const t = useGT();
  const m = useMessages();
  return (
    <header>
      <T>Free shipping on all orders over $50</T>
      <nav>
        {navLinks.map((link) => (
          <a key={link.href} href={link.href}>
            {m(link.label)}
          </a>
        ))}
      </nav>
      <input type='search' placeholder={t`Search products`} />
      <button type='button'>{t`Sign in`}</button>
      <h3>{t`Recently viewed`}</h3>
    </header>
  );
}
