<script setup>
import { Select, T } from 'gt-vue';

const Tr = T;
const B = Select;
</script>

<template>
  <Tr><B :value="tone" formal="Hello">Fallback</B></Tr>
</template>
