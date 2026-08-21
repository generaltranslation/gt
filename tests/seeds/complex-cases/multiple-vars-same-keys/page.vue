<script setup lang="ts">
import { Branch, Currency, Num, T, Var } from 'gt-vue';

const amount = 100.5;
const count = 5;
const variable = 'test';
</script>

<template>
  <T>
    <Branch branch="type">
      <template #option1>
        <div>First: <Var>{{ variable }}</Var>Second: <Num :value="count" />Third: <Currency :value="amount" currency="USD" /></div>
      </template>
      <template #option2>
        <div>First: <Var>{{ variable }}</Var>Second: <Num :value="count" />Third: <Currency :value="amount" currency="USD" /></div>
      </template>
    </Branch>
  </T>
</template>
