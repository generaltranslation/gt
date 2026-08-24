<script setup lang="ts">
import { Branch, Plural, T, T as T2, useGT } from 'gt-vue';

const gt = useGT();
const rows = [{ value: 'row' }];
const value = 'attribute';
</script>

<template>
  <div v-for="gt in rows" v-if="gt('Outer v-if')" />
  <div v-for="{ value = gt('v-for default') } in rows" />
  <div :[gt('Directive')]="value" />
  <Card v-slot="{ value = gt('slot default') }" />

  <t-2>Digit-normalized component</t-2>
  <component :is="T">Dynamic component</component>

  <T><!-- ignored --><template #default>Explicit default</template></T>
  <T>
    <Branch branch="formal"><template #formal>First</template> <template #casual>Second</template></Branch>
  </T>
  <T>
    <Plural :n="1"><template #one>One</template> <template #other>Other</template></Plural>
  </T>
</template>
