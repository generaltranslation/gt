<script setup lang="ts">
import { T, Var } from 'gt-vue';

const test = 'test';
</script>

<template>
  <T
    ><Var>{{ test }}</Var><Var>{{ (() => test)() }}</Var
    ><Var><div>test</div></Var><Var></Var
  ></T>
</template>
