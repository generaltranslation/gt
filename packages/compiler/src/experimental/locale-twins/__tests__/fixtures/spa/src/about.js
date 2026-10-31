import { msg } from 'gt-react/experimental';
import { renderFooter } from './footer.js';

const aboutText = msg('About us');

export function showAbout() {
  document.body.append(aboutText + renderFooter());
}
