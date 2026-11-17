<script setup lang="ts">
import { T, Var, msg, useGT } from 'gt-vue';
const t = useGT();
const name = String(Date.now());
const dynamic = String(Date.now());
t(`Dynamic ${name}`);
t('Too long', { $maxChars: 12 });
t('Formatted', { $format: 'ICU' });
t('Interpolated', { name });
msg('Registered', { $id: 'custom' });
const visible = true;
</script>

<template>
  <T :context="dynamic">
    <div v-if="visible" :title="dynamic">{{ name }}</div>
    <Var :value="name">{{ name }}</Var>
  </T>
</template>
