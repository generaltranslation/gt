<script>
import { useGT } from 'gt-vue';

const setup = () => ({ gt: useGT() });
export default { setup };
</script>

<template>{{ gt('Concise setup return') }}</template>
