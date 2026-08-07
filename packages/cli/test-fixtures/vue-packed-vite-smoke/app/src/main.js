import { createGT } from 'gt-vue';
import { createApp } from 'vue';
import App from './App.vue';

const smoke = {
  catalogKeys: [],
  lookups: new Set(),
  ready: false,
  slotCalls: 0,
};
window.__GT_SMOKE__ = smoke;

const loadTranslations = async (locale) => {
  const catalog = (await import(`./_gt/${locale}.json`)).default;
  smoke.catalogKeys = Object.keys(catalog).sort();
  return new Proxy(catalog, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^[0-9a-f]{16}$/.test(key)) {
        smoke.lookups.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
};

async function mountApp() {
  const plugin = createGT({
    defaultLocale: 'en',
    loadTranslations,
    locale: 'fr',
  });
  await plugin.loadTranslations('fr');

  createApp(App).use(plugin).mount('#app');
  smoke.ready = true;
  document.querySelector('#app').dataset.ready = 'true';
}

void mountApp();
