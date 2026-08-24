<script setup>
import { T } from 'gt-vue';
</script>

<template>
  <T>
    <Card>
      Body
      <template #header><T context="header">Header</T></template>
    </Card>
  </T>
  <T>
    <template><b>Bare template</b></template>
  </T>
  <T><T>Nested</T></T>
</template>
