<script setup lang="ts">
import { ref } from 'vue';

const open = ref(true);

defineSlots<{
  default(props: { open: boolean; toggle: () => void }): unknown;
}>();

function toggle() {
  open.value = !open.value;
}
</script>

<template>
  <slot :open="open" :toggle="toggle" />
</template>
