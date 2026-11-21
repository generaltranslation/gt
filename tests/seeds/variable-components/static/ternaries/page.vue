<script setup lang="ts">
import { Select, T } from 'gt-vue';

const state = false;
</script>

<template>
  <T
    ><Select :value="state"
      ><template #true>The boy</template><template #false>The girl</template></Select
    > is beautiful</T
  >
</template>
