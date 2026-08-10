<script setup lang="ts">
import { Plural, T } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Plural :n="1" plural="files">
      <template #singular>
        <Fragment><Fragment>nested</Fragment> fragment</Fragment>
      </template>
    </Plural>
  </T>
</template>
