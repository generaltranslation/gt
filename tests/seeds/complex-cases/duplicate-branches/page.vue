<script setup lang="ts">
import { Select, Num, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const count = 5;
</script>

<template>
  <T>
    <Select value="copy">
      <template #version1>
        <Fragment>Identical content with <Var>same variable</Var> and{{ ' ' }}<Num :value="count" /></Fragment>
      </template>
      <template #version2>
        <Fragment>Identical content with <Var>same variable</Var> and{{ ' ' }}<Num :value="count" /></Fragment>
      </template>
      <template #different>
        <Fragment>Different content with <Var>other variable</Var> and{{ ' ' }}<Num :value="count + 1" /></Fragment>
      </template>
    </Select>
  </T>
</template>
