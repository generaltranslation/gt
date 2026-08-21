<script setup lang="ts">
import { Branch, T } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Branch branch="type" option1="" :option2="null" :option4="false">
      <template #option3><Fragment /></template>
    </Branch>
  </T>
</template>
