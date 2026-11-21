import { msg } from 'gt-next/unstable';

export const navLinks = [
  { href: '/', label: msg('Home') },
  { href: '/shop', label: msg`Shop` },
  { href: '/orders', label: msg('Orders') },
  { href: '/help', label: msg`Help & support` },
];

export const stockLabels = {
  outOfStock: msg({ context: 'Product availability badge' })`Out of stock`,
  lowStock: msg`Almost gone`,
};
