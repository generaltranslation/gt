<script setup lang="ts">
import { Branch, Plural, T, T as T2, useGT } from 'gt-vue';

const t = useGT();
const rows = [{ value: 'row' }];
</script>

<template>
  <div v-for="t in rows" v-if="t('Outer v-if')" />
  <div v-for="{ value = t('VForDefault') } in rows" />
  <div v-for="item in t('VForSource')" />
  <Card v-slot="{ value = t('SlotDefault') }" />

  <t-2>Digit-normalized component</t-2>
  <component :is="T">Dynamic component</component>

  <T>
    <!-- ignored -->
    <template #default>Explicit default</template>
  </T>
  <T>
    <Branch branch="formal">
      <template #formal>First</template>
      <template #casual>Second</template>
    </Branch>
  </T>
  <T>
    <Plural :n="1">
      <template #one>One</template>
      <template #default>Other</template>
    </Plural>
  </T>
</template>
