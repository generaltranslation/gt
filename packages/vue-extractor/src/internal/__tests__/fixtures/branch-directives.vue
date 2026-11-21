<script setup lang="ts">
import { Select, T } from 'gt-vue';
const tone = 'formal';
const handler = () => undefined;
</script>

<template>
  <T>
    <Select :value="tone" formal="Hello" @click="handler">Fallback</Select>
    <Select :value="tone" formal="Hello" v-model="tone">Fallback</Select>
    <Select :value="tone" :foo-bar.camel="'Hello'">Fallback</Select>
  </T>
</template>
