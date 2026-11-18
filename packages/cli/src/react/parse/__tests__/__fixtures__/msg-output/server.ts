import { getGT, getMessages } from 'gt-next/unstable/server';
import { saved } from './messages';

export async function load() {
  const gt = await getGT();
  const m = await getMessages();
  return [gt({ context: 'menu' })`Settings`, gt`Server title`, m(saved)];
}
