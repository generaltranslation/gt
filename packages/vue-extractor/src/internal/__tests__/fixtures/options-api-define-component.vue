<script lang="ts">
import { defineComponent } from 'vue';
import { T } from 'gt-vue';

const Translation = T;
const registeredComponents = { Translation };

export default defineComponent({
  components: registeredComponents,
});
</script>

<template><Translation>Defined component</Translation></template>
