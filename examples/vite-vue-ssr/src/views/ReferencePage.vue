<script setup lang="ts">
import { onServerPrefetch, ref } from 'vue';
import { DateTime, Num, Plural, T, Var, useGT } from 'gt-vue';

const gt = useGT();
const operationCount = ref(12);
const serviceName = 'Launch API';
const updatedAt = new Date('2026-08-01T12:00:00.000Z');

onServerPrefetch(async () => {
  await Promise.resolve();
});
</script>

<template>
  <article data-page="reference">
    <p class="eyebrow">GET /v1/launches</p>
    <T context="API reference introduction">
      <h1>
        Explore the
        <Var>{{ serviceName }}</Var>
      </h1>
      <p>Use this reference to understand every endpoint and response.</p>
    </T>

    <section class="card">
      <h2>{{ gt('Available operations') }}</h2>
      <T context="operation count">
        <Plural :n="operationCount">
          <template #one>One documented operation</template>
          <template #other>
            <Num :value="operationCount" />
            documented operations
          </template>
          No documented operations
        </Plural>
      </T>
      <p>
        {{ gt('Last updated') }}:
        <DateTime
          :value="updatedAt"
          :options="{
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
            year: 'numeric',
          }"
        />
      </p>
    </section>
  </article>
</template>
