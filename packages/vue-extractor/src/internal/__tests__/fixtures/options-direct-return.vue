<script>
import { useGT } from 'gt-vue';

export default {
  setup() {
    return { t: useGT() };
  },
};
</script>

<template>{{ t('Direct setup return') }}</template>
