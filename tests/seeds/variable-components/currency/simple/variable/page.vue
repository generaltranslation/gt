<script setup lang="ts">
import { Currency, T } from 'gt-vue';

const test = 100;
</script>

<template>
  <T
    ><Currency :value="test" currency="USD" /><Currency
      :value="(() => test)()"
      currency="USD"
    /><Currency :value="test + 1" currency="USD" /><Currency
      :value="0"
      currency="USD"
  /></T>
</template>
