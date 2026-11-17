<script>
import { useGT } from 'gt-vue';

const setup = () => ({ t: useGT() });
export default { setup };
</script>

<template>{{ t('Concise setup return') }}</template>
