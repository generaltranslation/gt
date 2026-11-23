<script setup lang="ts">
import { Select, T } from 'gt-vue';
</script>

<template>
  <T>
    <Select
      value="constructor"
      constructor="Constructor branch"
      toString="String branch"
    >
      Fallback
    </Select>
  </T>
</template>
