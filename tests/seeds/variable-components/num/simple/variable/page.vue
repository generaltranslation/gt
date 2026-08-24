<script setup lang="ts">
import { Num, T } from 'gt-vue';

const test = 100;
</script>

<template>
  <T
    ><Num :value="test" /><Num :value="(() => test)()" /><Num
      :value="test + 1"
    /><Num :value="0"
  /></T>
</template>
