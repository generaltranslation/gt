<script setup lang="ts">
import { DateTime, T } from 'gt-vue';

const test = new Date(0);
</script>

<template>
  <T
    ><DateTime :value="test" /><DateTime :value="(() => test)()" /><DateTime
      :value="new Date(test.getTime() + 1)"
    /><DateTime :value="new Date(0)"
  /></T>
</template>
