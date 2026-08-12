<script setup lang="ts">
import { T } from 'gt-vue';
import { moduleTranslation } from './moduleMessages';
</script>

<template>
  <T>Hello from the native Vue extractor</T>
  <p>{{ moduleTranslation }}</p>
</template>
