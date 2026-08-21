<script setup>
import { T, Var } from 'gt-vue';
</script>

<template>
  <T>
    Outer
    <Var><T>Inner</T></Var>
  </T>
</template>
