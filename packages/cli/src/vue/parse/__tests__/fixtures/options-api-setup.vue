<script>
import { T, msg, useGT, useMessages } from 'gt-vue';

export default {
  components: { T },
  setup() {
    const gt = useGT();
    const m = useMessages();
    return { gt, LocalT: T, m, register: msg };
  },
};
</script>

<template>
  <T>Composition API</T>
  <LocalT>Setup component</LocalT>
  {{ gt('Setup string') }}
  {{ m('Setup message') }}
  {{ register('Setup msg', { $context: 'classic' }) }}
</template>
