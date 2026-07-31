<script>
import { T, msg, useGT, useMessages } from 'gt-vue';

export default {
  components: { T },
  setup() {
    const gt = useGT();
    const m = useMessages();
    return { gt, m, register: msg };
  },
};
</script>

<template>
  <T>Composition API</T>
  {{ gt('Setup string') }}
  {{ m('Setup message') }}
  {{ register('Setup msg', { $context: 'classic' }) }}
</template>
