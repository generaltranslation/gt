import { createApp } from 'vue';
import { createGT, initializeGT } from 'gt-vue';
import App from './App.vue';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';
import '../../../brand/gt-brand.css';
import './app.css';

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  loadTranslations,
});

createApp(App).use(createGT()).mount('#app');
