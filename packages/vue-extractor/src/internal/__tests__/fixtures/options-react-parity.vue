<script lang="ts">
import { defineComponent as define } from 'vue';
import { T as SourceT, useGT as createGT } from 'gt-vue';

const defineAlias = define;
const LocalT = SourceT;

const setup = () => {
  const original = createGT();
  const translate = original;
  const exposed = { translate };
  return { ...exposed };
};

const options = {
  components: { LocalT },
  setup,
};

export default defineAlias(options);
</script>

<template>
  <LocalT>Options registered alias</LocalT>
  {{ translate('Options returned alias') }}
</template>
