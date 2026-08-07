<script setup lang="ts">
import { ref } from 'vue';
import { T, Var, useGT } from 'gt-vue';

const gt = useGT();
const productName = 'Orbit';
const selectedTab = ref<'quickstart' | 'concepts'>('quickstart');
</script>

<template>
  <article data-page="guide">
    <p class="eyebrow">gt-vue · SSR</p>
    <T context="docs landing introduction">
      <h1>Developer documentation</h1>
      <p>
        Build reliable integrations with
        <Var>{{ productName }}</Var>
        .
      </p>
    </T>

    <div class="tabs" role="tablist" :aria-label="gt('Guide sections')">
      <button
        role="tab"
        type="button"
        :aria-selected="selectedTab === 'quickstart'"
        @click="selectedTab = 'quickstart'"
      >
        {{ gt('Quickstart') }}
      </button>
      <button
        role="tab"
        type="button"
        :aria-selected="selectedTab === 'concepts'"
        @click="selectedTab = 'concepts'"
      >
        {{ gt('Core concepts') }}
      </button>
    </div>

    <Transition name="fade" mode="out-in">
      <section :key="selectedTab" class="card" role="tabpanel">
        <T v-if="selectedTab === 'quickstart'" context="quickstart card">
          <h2>Make your first request</h2>
          <p>Create a client and send a request in a few lines of code.</p>
        </T>
        <T v-else context="concepts card">
          <h2>Understand the platform</h2>
          <p>Learn how projects, environments, and releases fit together.</p>
        </T>
      </section>
    </Transition>
  </article>
</template>
