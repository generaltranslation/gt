import { msg } from 'gt-react/experimental';
import { formatLabel } from 'fake-lib';
import { startApp } from 'fake-framework';
import { renderFooter } from './footer.js';

export const title = msg('Welcome home');

document.querySelector('#app').textContent =
  formatLabel(title) + renderFooter() + startApp();

document.addEventListener('click', () => {
  import('./about.js').then((page) => page.showAbout());
  import('./plain.js').then((page) => page.showPlain());
});
