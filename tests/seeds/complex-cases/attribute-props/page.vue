<script setup lang="ts">
import { Select, T } from 'gt-vue';
</script>

<template>
  <T>
    <Select value="element">
      <template #input><input placeholder="Select placeholder" title="Select title" /></template>
      <template #image>
        <img src="test.jpg" alt="Select image" title="Select image title" />
      </template>
      <template #link>
        <a href="#" aria-label="Select link" aria-describedby="desc">Link</a>
      </template>
    </Select>
  </T>
</template>
