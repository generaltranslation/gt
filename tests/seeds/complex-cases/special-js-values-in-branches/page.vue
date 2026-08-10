<script setup lang="ts">
import { Branch, T } from 'gt-vue';
</script>

<template>
  <T>
    <Branch
      branch="type"
      :number="42"
      :big-number="9007199254740991"
      :scientific="1e-20"
      :negative-scientific="-1e20"
      :hex="0xdeadbeef"
      :octal="0o755"
      :binary="0b11111111"
    />
  </T>
</template>
