<script setup lang="ts">
import { Select, Currency, Num, T, Var } from 'gt-vue';

const amount = 100.5;
const count = 5;
const variable = 'test';
</script>

<template>
  <T>
    <Select value="type">
      <template #option1>
        <div>First: <Var>{{ variable }}</Var>Second: <Num :value="count" />Third: <Currency :value="amount" currency="USD" /></div>
      </template>
      <template #option2>
        <div>First: <Var>{{ variable }}</Var>Second: <Num :value="count" />Third: <Currency :value="amount" currency="USD" /></div>
      </template>
    </Select>
  </T>
</template>
