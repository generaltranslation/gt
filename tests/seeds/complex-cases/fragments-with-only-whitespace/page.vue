<script setup lang="ts">
import { Plural, T } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Plural :n="1">
      <template #singular><Fragment>{{ ' ' }}</Fragment></template>
      <template #plural><Fragment /></template>
    </Plural>
  </T>
</template>
