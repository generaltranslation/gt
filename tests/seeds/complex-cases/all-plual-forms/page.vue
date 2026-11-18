<script setup lang="ts">
import { Plural, T } from 'gt-vue';

const count = 5;
</script>

<template>
  <T>
    <Plural
      :n="count"
      zero="zero items"
      one="one item"
      two="two items"
      few="few items"
      many="many items"
      _1="singular form"
      _2="plural form">other items</Plural>
  </T>
</template>
