<script setup lang="ts">
import { Plural, T } from 'gt-vue';
</script>

<template>
  <T>
    <Plural
      :n="1"
      singular="This is an extremely long string value that tests how the plugin handles very long attribute content that might span multiple lines and contain various characters including unicode ñáéíóú and emoji 📁📂🎉"
      plural="This is an extremely long template literal that tests how the plugin handles very long template content with potential whitespace normalization issues and various characters"
    />
  </T>
</template>
