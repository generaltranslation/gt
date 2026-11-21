<script setup lang="ts">
import { Select, T } from 'gt-vue';
</script>

<template><T><Select value="morning" evening="Good evening"><template #morning><Select value="time" morning="Good morning" evening="Good evening" /></template></Select></T></template>
