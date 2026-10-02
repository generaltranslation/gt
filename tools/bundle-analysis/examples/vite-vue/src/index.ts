import { initializeGTSPA } from 'gt-vue';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

const gt = await initializeGTSPA({ ...gtConfig, loadTranslations });

const { mount } = await import('./main');
mount(gt, [gtConfig.defaultLocale, ...gtConfig.locales]);
