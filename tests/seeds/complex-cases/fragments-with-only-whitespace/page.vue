<script setup lang="ts">
import { Plural, T } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Plural :n="1">
      <template #_1><Fragment>{{ ' ' }}</Fragment></template>
      <template #_2><Fragment /></template>
    </Plural>
  </T>
</template>
