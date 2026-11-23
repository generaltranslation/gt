<script setup lang="ts">
import { Select, T } from 'gt-vue';
</script>

<template><T><Select value="morning" morning="Good morning" evening="Good evening" /><Select value="morning" :morning="'Good morning'" evening="Good evening" /><Select value="morning" :morning="`Good morning`" evening="Good evening" /><Select value="morning" :morning="`Good morning`" evening="Good evening">{{ 'default' }}</Select><Select value="morning" :morning="`Good morning`" evening="Good evening">{{ `default` }}</Select></T></template>
