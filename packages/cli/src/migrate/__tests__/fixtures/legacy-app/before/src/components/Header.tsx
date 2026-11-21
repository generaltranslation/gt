'use client';

import { T, useGT, useMessages } from 'gt-next';
import { navLinks } from '../lib/messages';

export function Header() {
  const gt = useGT();
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
      <input type='search' placeholder={gt('Search products')} />
      <button type='button'>{gt('Sign in')}</button>
    </header>
  );
}
