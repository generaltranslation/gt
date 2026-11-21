<script setup lang="ts">
import { Select, T } from 'gt-vue';
</script>

<template>
  <T>
    <Select value="content" empty="" space=" " :newline="'\n'" :tab="'\t'" singleChar="x">
      <template #minimal><span></span></template>
    </Select>
  </T>
</template>
