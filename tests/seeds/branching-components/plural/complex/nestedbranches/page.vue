<script setup lang="ts">
import { Plural, T } from 'gt-vue';
</script>

<template><T><Plural :n="1"><template #one><Plural :n="1" one="Good morning">Good evening</Plural></template><template #default>Good evening</template></Plural></T></template>
