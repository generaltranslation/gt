import { initializeGTSPA } from 'gt-vue';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './translations';

const gt = await initializeGTSPA({
  ...gtConfig,
  loadTranslations,
});

const { mount } = await import('./main');

mount(gt);
