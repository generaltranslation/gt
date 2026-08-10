<script setup lang="ts">
import { Branch, T } from 'gt-vue';
</script>

<template><T><Branch branch="morning" morning="Good morning" evening="Good evening" /><Branch branch="morning" :morning="'Good morning'" evening="Good evening" /><Branch branch="morning" :morning="`Good morning`" evening="Good evening" /><Branch branch="morning" :morning="`Good morning`" evening="Good evening">{{ 'default' }}</Branch><Branch branch="morning" :morning="`Good morning`" evening="Good evening">{{ `default` }}</Branch></T></template>
