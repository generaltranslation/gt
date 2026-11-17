<script setup lang="ts">
import { Plural, T } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Plural :n="1" _2="files">
      <template #_1>
        <Fragment><Fragment>nested</Fragment> fragment</Fragment>
      </template>
    </Plural>
  </T>
</template>
