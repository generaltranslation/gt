import { createApp } from 'vue';
import type { GTPlugin } from 'gt-vue';
import App from './App.vue';

export function mount(gt: GTPlugin): void {
  createApp(App).use(gt).mount('#app');
}
