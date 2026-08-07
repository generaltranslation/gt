<script>
import { useGT } from 'gt-vue';

export default {
  setup() {
    return { gt: useGT() };
  },
};
</script>

<template>{{ gt('Direct setup return') }}</template>
