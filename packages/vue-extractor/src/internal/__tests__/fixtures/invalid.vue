<script setup lang="ts">
import { T, Var, msg, useGT } from 'gt-vue';
const gt = useGT();
const name = String(Date.now());
const dynamic = String(Date.now());
gt(`Dynamic ${name}`);
gt('Too long', { $maxChars: 12 });
gt('Formatted', { $format: 'ICU' });
gt('Interpolated', { name });
msg('Registered', { $id: 'custom' });
const visible = true;
</script>

<template>
  <T :context="dynamic">
    <div v-if="visible" :title="dynamic">{{ name }}</div>
    <Var :value="name">{{ name }}</Var>
  </T>
</template>
