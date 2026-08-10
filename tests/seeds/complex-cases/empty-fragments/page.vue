<script setup lang="ts">
import { Plural, T } from 'gt-vue';
</script>

<template>
  <T>
    <Plural :n="1" plural="files"><template #singular></template></Plural>
  </T>
</template>
