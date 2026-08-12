<script>
import { useGT } from 'gt-vue';

export default {
  setup() {
    const gt = useGT();
    const exposed = { gt };
    return { ...exposed };
  },
};
</script>

<template>{{ gt('Spread setup return') }}</template>
