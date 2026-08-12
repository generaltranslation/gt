<script setup lang="ts">
import { useGT, useLocale, useSetLocale } from 'gt-vue';
import { moduleEvaluationCount, moduleGreeting } from './moduleMessages';

const gt = useGT();
const locale = useLocale();
const setLocale = useSetLocale();

document.documentElement.lang = locale.value;

async function selectLocale(event: Event) {
  await setLocale((event.target as HTMLSelectElement).value);
}
</script>

<template>
  <main>
    <h1>{{ moduleGreeting }}</h1>
    <p>{{ gt('Component translation shares the SPA runtime.') }}</p>
    <p>Locale: {{ locale }}</p>
    <p>Module evaluations: {{ moduleEvaluationCount }}</p>
    <p>Bootstrap: ready</p>
    <label>
      Locale
      <select
        aria-label="General Translation locale selector"
        :value="locale"
        @change="selectLocale"
      >
        <option value="en">English</option>
        <option value="fr">French</option>
      </select>
    </label>
  </main>
</template>
