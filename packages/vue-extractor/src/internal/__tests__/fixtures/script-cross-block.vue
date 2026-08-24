<script lang="ts">
import { T, useGT } from 'gt-vue';
</script>

<script setup lang="ts">
// oxlint-disable-next-line no-undef -- verifies imports shared from the normal script block
const gt = useGT();
gt('Cross-block script call');
</script>

<template>
  <T>Cross-block component</T>
  {{ gt('Cross-block template call') }}
</template>
