<script setup lang="ts">
import { Select, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const count = 5;
const variable = 'test';
</script>

<template>
  <T>Normal text <div>nested content</div> more text<Plural
      :n="count"
      zero="No files"
      one="One file"
      two="Two files"
      few="Few files"
      many="Many files"
    >
      <template #_1><Fragment>Single file</Fragment></template>
    <template #default>Other files</template></Plural>
    <Select value="context" option1="" option2="   padded   ">
      <template #option3><Var>{{ variable }}</Var></template>
      <template #option4><Fragment>fragment content</Fragment></template>
      <template #option5><div>element content</div></template>
    </Select></T>
</template>
