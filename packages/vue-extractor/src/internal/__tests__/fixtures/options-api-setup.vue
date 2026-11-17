<script>
import { T, msg, useGT, useMessages } from 'gt-vue';

export default {
  components: { T },
  setup() {
    const t = useGT();
    const m = useMessages();
    return { t, LocalT: T, m, register: msg };
  },
};
</script>

<template>
  <T>Composition API</T>
  <component :is="LocalT">Setup component</component>
  {{ t('Setup string') }}
  {{ m('Setup message') }}
  {{ register('Setup msg', { $context: 'classic' }) }}
</template>
