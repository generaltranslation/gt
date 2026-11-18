<script setup lang="ts">
import { Plural, T } from 'gt-vue';
</script>

<template><T><Plural :n="1"><template #one><div>Good morning</div></template><template #default><div>Good evening</div></template></Plural></T></template>
