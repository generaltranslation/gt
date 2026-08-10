<script setup lang="ts">
import { Plural, T } from 'gt-vue';
</script>

<template><T><Plural :n="1" other="Good evening"><template #one><Plural :n="1" one="Good morning" other="Good evening" /></template></Plural></T></template>
