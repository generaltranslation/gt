import { initializeGTSPA } from 'gt-react';
import { loadTranslations } from './loadTranslations';
import gtConfig from '../gt.config.json';

// An app in which only the minifier removes a call site, for late.html:
// scripts/check-module.mjs builds it with CHECK_LATE_REMOVAL. The page shows
// each message of its two routes in an element of its own.
await initializeGTSPA({ ...gtConfig, loadTranslations });

const { openFirst, openSecond } = await import('./late/Shell');
for (const open of [openFirst, openSecond]) {
  const { messages } = await open();
  for (const [name, text] of Object.entries(messages())) {
    const element = document.createElement('p');
    element.dataset.test = name;
    element.textContent = text;
    document.body.append(element);
  }
}
document.body.dataset.ready = 'true';
