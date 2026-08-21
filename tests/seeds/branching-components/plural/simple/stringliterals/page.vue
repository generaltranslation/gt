<script setup lang="ts">
import { Plural, T } from 'gt-vue';
</script>

<template><T><Plural :n="1" one="Good morning" other="Good evening" /><Plural :n="1" :one="'Good morning'" other="Good evening" /><Plural :n="1" :one="`Good morning`" other="Good evening" /><Plural :n="1" :one="`Good morning`" other="Good evening">{{ 'default' }}</Plural><Plural :n="1" :one="`Good morning`" other="Good evening">{{ `default` }}</Plural></T></template>
