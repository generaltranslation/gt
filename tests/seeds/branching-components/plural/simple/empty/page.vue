<script setup lang="ts">
import { Fragment } from 'vue';
import { Plural, T } from 'gt-vue';
</script>

<template><T><Plural :n="1"><template #one><Fragment /></template><template #default>{{ '' }}</template></Plural></T></template>
