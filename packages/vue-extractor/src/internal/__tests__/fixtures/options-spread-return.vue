<script>
import { useGT } from 'gt-vue';

export default {
  setup() {
    const t = useGT();
    const exposed = { t };
    return { ...exposed };
  },
};
</script>

<template>{{ t('Spread setup return') }}</template>
