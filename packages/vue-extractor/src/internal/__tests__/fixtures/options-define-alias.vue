<script>
import { defineComponent } from 'vue';
import { T } from 'gt-vue';

const dc = defineComponent;
export default dc({ components: { T } });
</script>

<template><T>Aliased defineComponent</T></template>
