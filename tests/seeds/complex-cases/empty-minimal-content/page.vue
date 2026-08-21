<script setup lang="ts">
import { Branch, T } from 'gt-vue';
</script>

<template>
  <T>
    <Branch branch="content" empty="" space=" " :newline="'\n'" :tab="'\t'" singleChar="x">
      <template #minimal><span></span></template>
    </Branch>
  </T>
</template>
