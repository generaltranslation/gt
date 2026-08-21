import { initializeGTSPA } from 'gt-vue';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

const gt = await initializeGTSPA({ ...gtConfig, loadTranslations });
window.__gtVueSPAInitialized = true;

const { mount } = await import('./main');
mount(gt);
