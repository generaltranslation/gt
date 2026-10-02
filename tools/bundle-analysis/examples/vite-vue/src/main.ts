import { createApp } from 'vue';
import type { GTPlugin } from 'gt-vue';
import App from './App.vue';
import '../../../brand/gt-brand.css';
import './app.css';

export function mount(gt: GTPlugin, locales: readonly string[]): void {
  createApp(App, { locales }).use(gt).mount('#app');
}
