import { createApp } from 'vue';
import type { GTPlugin } from 'gt-vue';
import App from './App.vue';
import './style.css';

/** Mounts the app with the preloaded GT SPA runtime. */
export function mount(gt: GTPlugin): void {
  createApp(App).use(gt).mount('#app');
}
