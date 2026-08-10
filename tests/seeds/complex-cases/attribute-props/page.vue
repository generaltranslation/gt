<script setup lang="ts">
import { Branch, T } from 'gt-vue';
</script>

<template>
  <T>
    <Branch branch="element">
      <template #input><input placeholder="Branch placeholder" title="Branch title" /></template>
      <template #image>
        <img src="test.jpg" alt="Branch image" title="Branch image title" />
      </template>
      <template #link>
        <a href="#" aria-label="Branch link" aria-describedby="desc">Link</a>
      </template>
    </Branch>
  </T>
</template>
