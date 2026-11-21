import { msg } from 'gt-next';

export const navLinks = [
  { href: '/', label: msg('Home') },
  { href: '/shop', label: msg('Shop') },
  { href: '/orders', label: msg('Orders') },
  { href: '/help', label: msg('Help center') },
];

export const stockLabels = {
  outOfStock: msg('Out of stock', { $context: 'Product availability badge' }),
  lowStock: msg('Almost gone'),
};
