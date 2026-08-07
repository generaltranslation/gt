<script setup>
import { T } from 'gt-vue';

const items = ['one'];
</script>

<template>
  <T v-for="T in items" :key="T">Loop scope</T>
  <Some v-slot="{ T }"><T>Slot scope</T></Some>
</template>
