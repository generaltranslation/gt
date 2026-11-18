import { msg } from 'gt-next/unstable';
import { msg as stableMsg } from 'gt-next';

export const welcome = msg`Welcome back`;
export const menu = msg({ context: 'menu' })`Settings`;
export const saved = stableMsg('Saved');
