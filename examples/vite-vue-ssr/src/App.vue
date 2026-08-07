<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useGT, useLocale, useMessages } from 'gt-vue';
import DisclosurePanel from './components/DisclosurePanel.vue';
import SearchDialog from './components/SearchDialog.vue';
import { TsxCompatibilityCard } from './components/TsxCompatibilityCard';
import { linkCopiedMessage } from './messages';

const gt = useGT();
const m = useMessages();
const locale = useLocale();
const route = useRoute();
const searchOpen = ref(false);
const toast = ref('');
const routeSuffix = computed(() => {
  const suffix = route.path.replace(/^\/fr(?=\/|$)/, '');
  return suffix || '/';
});
const guidePath = computed(() => (locale.value === 'fr' ? '/fr' : '/'));
const referencePath = computed(() =>
  locale.value === 'fr' ? '/fr/reference' : '/reference'
);

if (typeof document !== 'undefined') {
  watch(
    locale,
    (nextLocale) => {
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = 'ltr';
    },
    { immediate: true }
  );
}

function localePath(nextLocale: 'en' | 'fr'): string {
  if (nextLocale === 'fr') {
    return routeSuffix.value === '/' ? '/fr' : `/fr${routeSuffix.value}`;
  }
  return routeSuffix.value;
}

function copyPageLink() {
  toast.value = m(linkCopiedMessage);
}
</script>

<template>
  <div class="docs-shell">
    <header class="topbar">
      <RouterLink class="brand" :to="guidePath">
        {{ gt('Developer hub') }}
      </RouterLink>
      <nav :aria-label="gt('Primary navigation')">
        <RouterLink :to="guidePath">{{ gt('Guides') }}</RouterLink>
        <RouterLink :to="referencePath">{{ gt('API reference') }}</RouterLink>
      </nav>
      <div class="topbar-actions">
        <button
          type="button"
          :aria-label="gt('Open search')"
          @click="searchOpen = true"
        >
          {{ gt('Search') }}
        </button>
        <div class="locale-links" :aria-label="gt('Language')">
          <RouterLink
            :aria-current="locale === 'en' ? 'true' : undefined"
            :to="localePath('en')"
          >
            English
          </RouterLink>
          <RouterLink
            :aria-current="locale === 'fr' ? 'true' : undefined"
            :to="localePath('fr')"
          >
            Français
          </RouterLink>
        </div>
      </div>
    </header>

    <div class="shell-body">
      <aside>
        <DisclosurePanel v-slot="{ open, toggle }">
          <button type="button" :aria-expanded="open" @click="toggle">
            {{ open ? gt('Hide quick links') : gt('Show quick links') }}
          </button>
          <Transition name="slide">
            <nav v-if="open" :aria-label="gt('Quick links')">
              <RouterLink :to="guidePath">{{ gt('Overview') }}</RouterLink>
              <RouterLink :to="referencePath">
                {{ gt('Endpoints') }}
              </RouterLink>
            </nav>
          </Transition>
        </DisclosurePanel>
      </aside>

      <main>
        <RouterView v-slot="{ Component }">
          <Suspense timeout="0">
            <template #default>
              <component :is="Component" />
            </template>
            <template #fallback>
              <p role="status">{{ gt('Loading page…') }}</p>
            </template>
          </Suspense>
        </RouterView>
        <div class="page-actions">
          <button type="button" @click="copyPageLink">
            {{ gt('Copy page link') }}
          </button>
          <p v-if="toast" class="toast" role="status">{{ toast }}</p>
        </div>
        <TsxCompatibilityCard />
      </main>
    </div>

    <SearchDialog :open="searchOpen" @close="searchOpen = false" />
  </div>
</template>
