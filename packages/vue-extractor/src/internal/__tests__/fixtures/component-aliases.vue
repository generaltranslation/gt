<script setup>
import { Branch, T } from 'gt-vue';

const Tr = T;
const B = Branch;
</script>

<template>
  <Tr><B :branch="tone" formal="Hello">Fallback</B></Tr>
</template>
