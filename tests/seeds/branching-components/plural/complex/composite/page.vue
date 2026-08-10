<script setup lang="ts">
import { Num, Plural, T } from 'gt-vue';

const count = 1;
</script>

<template><T><Plural :n="count"><template #one><p>There is <Num :value="count" /> item</p></template><template #other><p>There are <Num :value="count" /> items</p></template></Plural></T></template>
