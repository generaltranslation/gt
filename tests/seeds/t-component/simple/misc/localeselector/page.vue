<script setup lang="ts">
import { defineComponent, h } from 'vue';
import { T } from 'gt-vue';

const LocaleSelector = defineComponent({
  name: 'LocaleSelector',
  setup() {
    return () => h('select');
  },
});
</script>

<template><T>Let's select some locales<LocaleSelector /></T></template>
