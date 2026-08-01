<script setup lang="ts">
import { Branch, T } from 'gt-vue';
const tone = 'formal';
const handler = () => undefined;
</script>

<template>
  <T>
    <Branch :branch="tone" formal="Hello" @click="handler">Fallback</Branch>
    <Branch :branch="tone" formal="Hello" v-model="tone">Fallback</Branch>
    <Branch :branch="tone" :foo-bar.camel="'Hello'">Fallback</Branch>
  </T>
</template>
