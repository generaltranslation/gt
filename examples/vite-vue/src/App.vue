<script setup lang="ts">
import { ref, watch } from 'vue';
import { TsxCompatibilityCard } from './components/TsxCompatibilityCard';
import {
  Branch,
  Currency,
  DateTime,
  Num,
  Plural,
  T,
  Var,
  msg,
  useGT,
  useLocale,
  useMessages,
  useSetLocale,
} from 'gt-vue';

const gt = useGT();
const m = useMessages();
const locale = useLocale();
const setLocale = useSetLocale();

const name = 'Ada';
const itemCount = ref(2);
const tone = ref<'formal' | 'casual'>('formal');
const changingLocale = ref(false);
const launchDate = new Date('2026-06-18T12:00:00.000Z');
const projectBudget = 1299.5;
const savedMessage = msg('Your preferences are saved.', {
  $context: 'status message',
});

watch(
  locale,
  (currentLocale) => {
    document.documentElement.lang = currentLocale;
  },
  { immediate: true }
);

async function selectLocale(nextLocale: string) {
  if (nextLocale === locale.value) return;
  changingLocale.value = true;
  try {
    await setLocale(nextLocale);
  } finally {
    changingLocale.value = false;
  }
}
</script>

<template>
  <main>
    <nav class="language-switcher" aria-label="Language">
      <span class="language-label">{{ gt('Language') }}</span>
      <button
        type="button"
        :aria-pressed="locale === 'en'"
        :disabled="changingLocale"
        @click="selectLocale('en')"
      >
        English
      </button>
      <button
        type="button"
        :aria-pressed="locale === 'fr'"
        :disabled="changingLocale"
        @click="selectLocale('fr')"
      >
        Français
      </button>
    </nav>

    <section class="hero" :aria-busy="changingLocale">
      <p class="eyebrow">gt-vue + Vite</p>
      <T context="hero">
        <h1>
          Hello,
          <Var>{{ name }}</Var>
          !
        </h1>
        <p>A small Vue app powered by lightweight translation lookups.</p>
      </T>
      <p class="lookup">
        {{ gt('This sentence comes from useGT().', { $context: 'demo' }) }}
      </p>
      <p class="status" role="status">{{ m(savedMessage) }}</p>
    </section>

    <section class="demo-grid" aria-label="Translation examples">
      <article>
        <h2>{{ gt('Plural and number') }}</h2>
        <T context="item count">
          <Plural :n="itemCount">
            <template #one>You have one item.</template>
            <template #other>
              You have
              <Num :value="itemCount" />
              items.
            </template>
            You have no items.
          </Plural>
        </T>
        <div class="controls">
          <button
            type="button"
            :aria-label="gt('Remove one item')"
            :disabled="itemCount === 0"
            @click="itemCount--"
          >
            −
          </button>
          <output :aria-label="gt('Item count')">{{ itemCount }}</output>
          <button
            type="button"
            :aria-label="gt('Add one item')"
            @click="itemCount++"
          >
            +
          </button>
        </div>
      </article>

      <article>
        <h2>{{ gt('Branch selection') }}</h2>
        <T context="welcome tone">
          <Branch :branch="tone">
            <template #formal>It is a pleasure to welcome you.</template>
            <template #casual>Great to see you!</template>
            Welcome.
          </Branch>
        </T>
        <div class="controls segmented">
          <button
            type="button"
            :aria-pressed="tone === 'formal'"
            @click="tone = 'formal'"
          >
            {{ gt('Formal') }}
          </button>
          <button
            type="button"
            :aria-pressed="tone === 'casual'"
            @click="tone = 'casual'"
          >
            {{ gt('Casual') }}
          </button>
        </div>
      </article>

      <article>
        <h2>{{ gt('Locale-aware values') }}</h2>
        <dl>
          <div>
            <dt>{{ gt('Budget') }}</dt>
            <dd>
              <Currency :value="projectBudget" currency="EUR" />
            </dd>
          </div>
          <div>
            <dt>{{ gt('Launch date') }}</dt>
            <dd>
              <DateTime
                :value="launchDate"
                :options="{
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'UTC',
                  year: 'numeric',
                }"
              />
            </dd>
          </div>
        </dl>
      </article>

      <article>
        <h2>{{ gt('Plain strings stay plain') }}</h2>
        <p>
          {{
            gt('Braces are literal: {name}', {
              $context: 'literal braces example',
            })
          }}
        </p>
      </article>

      <TsxCompatibilityCard />
    </section>
  </main>
</template>
