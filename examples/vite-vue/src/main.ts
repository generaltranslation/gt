import { createApp } from 'vue';
import { createGT } from 'gt-vue';
import App from './App.vue';
import { loadTranslations } from './translations';
import './style.css';

const gt = createGT({
  defaultLocale: 'en',
  loadTranslations,
});

createApp(App).use(gt).mount('#app');
