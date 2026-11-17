<script lang="ts">
import { T, useGT } from 'gt-vue';
</script>

<script setup lang="ts">
// oxlint-disable-next-line no-undef -- verifies imports shared from the normal script block
const t = useGT();
t('Cross-block script call');
</script>

<template>
  <T>Cross-block component</T>
  {{ t('Cross-block template call') }}
</template>
