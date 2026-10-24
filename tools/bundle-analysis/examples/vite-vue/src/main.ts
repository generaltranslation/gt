import { createApp } from 'vue';
import { createGT } from 'gt-vue';
import App from './App.vue';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';
import '../../../brand/gt-brand.css';
import './app.css';

const gt = createGT({
  defaultLocale: gtConfig.defaultLocale,
  loadTranslations,
});

createApp(App).use(gt).mount('#app');
