<script setup lang="ts">
import { Select, T } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Select value="type" option1="" :option2="null" :option4="false">
      <template #option3><Fragment /></template>
    </Select>
  </T>
</template>
