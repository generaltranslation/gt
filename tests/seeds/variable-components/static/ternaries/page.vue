<script setup lang="ts">
import { Branch, T } from 'gt-vue';

const state = false;
</script>

<template>
  <T
    ><Branch :branch="state"
      ><template #true>The boy</template><template #false>The girl</template></Branch
    > is beautiful</T
  >
</template>
