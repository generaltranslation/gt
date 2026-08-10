<script setup lang="ts">
import { Branch, Plural, T, Var } from 'gt-vue';
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
      other="Other files"
    >
      <template #singular><Fragment>Single file</Fragment></template>
    </Plural>
    <Branch branch="context" option1="" option2="   padded   ">
      <template #option3><Var>{{ variable }}</Var></template>
      <template #option4><Fragment>fragment content</Fragment></template>
      <template #option5><div>element content</div></template>
    </Branch></T>
</template>
