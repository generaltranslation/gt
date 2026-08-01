<script setup>
import { T } from 'gt-vue';
</script>

<template>
  <T>
    <Card>
      <template #header>Header</template>
      <template #default>Body</template>
    </Card>
  </T>
  <T>
    <template><b>Bare template</b></template>
  </T>
  <T><T>Nested</T></T>
</template>
