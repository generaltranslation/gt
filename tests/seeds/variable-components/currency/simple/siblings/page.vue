<script setup lang="ts">
import { Currency, T } from 'gt-vue';
</script>

<template>
  <T>First sibling<Currency :value="100" currency="USD" /></T>
</template>
