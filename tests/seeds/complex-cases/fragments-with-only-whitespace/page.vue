<script setup lang="ts">
import { Plural, T } from 'gt-vue';
</script>

<template>
  <T>
    <Plural :n="1">
      <template #singular>{{ ' ' }}</template>
      <template #plural></template>
    </Plural>
  </T>
</template>
