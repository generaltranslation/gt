<script setup lang="ts">
import { Branch, T, Var } from 'gt-vue';

const name = 'John';
</script>

<template><T><Branch :branch="name"><template #John><p>Good morning <Var>{{ name }}</Var></p></template><template #Rose><p>Good evening <Var>{{ name }}</Var></p></template></Branch></T></template>
