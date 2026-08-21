<script setup lang="ts">
import { DateTime, T } from 'gt-vue';

const timestamp = new Date();
</script>

<template>
  <T><DateTime :value="timestamp" /></T>
</template>
