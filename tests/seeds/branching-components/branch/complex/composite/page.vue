<script setup lang="ts">
import { Select, T, Var } from 'gt-vue';

const name = 'John';
</script>

<template><T><Select :value="name"><template #John><p>Good morning <Var>name</Var></p></template><template #Rose><p>Good evening <Var>name</Var></p></template></Select></T></template>
