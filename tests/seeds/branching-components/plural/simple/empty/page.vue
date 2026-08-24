<script setup lang="ts">
import { Fragment } from 'vue';
import { Plural, T } from 'gt-vue';
</script>

<template><T><Plural :n="1" other=""><template #one><Fragment /></template></Plural></T></template>
