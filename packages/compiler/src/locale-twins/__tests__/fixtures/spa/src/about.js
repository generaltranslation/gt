import { msg } from 'gt-react';
import { renderFooter } from './footer.js';

const aboutText = msg('About us');

export function showAbout() {
  document.body.append(aboutText + renderFooter());
}
