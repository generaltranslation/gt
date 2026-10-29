import { manifest } from 'virtual:gt-locale-twins-manifest';
import { msg } from 'gt-react';
import { formatLabel } from 'fake-lib';

export const title = msg('Welcome home');

export function render() {
  return { manifest, title: formatLabel(title) };
}
