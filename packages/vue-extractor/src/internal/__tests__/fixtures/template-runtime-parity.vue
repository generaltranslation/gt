<script setup lang="ts">
import { Select, Plural, T, T as T2, useGT } from 'gt-vue';

const t = useGT();
const rows = [{ value: 'row' }];
const value = 'attribute';
</script>

<template>
  <div v-for="t in rows" v-if="t('Outer v-if')" />
  <div v-for="{ value = t('v-for default') } in rows" />
  <div :[t('Directive')]="value" />
  <Card v-slot="{ value = t('slot default') }" />

  <t-2>Digit-normalized component</t-2>
  <component :is="T">Dynamic component</component>

  <T><!-- ignored --><template #default>Explicit default</template></T>
  <T>
    <Select value="formal"><template #formal>First</template> <template #casual>Second</template></Select>
  </T>
  <T>
    <Plural :n="1"><template #one>One</template> <template #default>Other</template></Plural>
  </T>
</template>
