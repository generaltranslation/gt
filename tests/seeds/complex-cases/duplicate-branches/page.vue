<script setup lang="ts">
import { Branch, Num, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const count = 5;
</script>

<template>
  <T>
    <Branch branch="copy">
      <template #version1>
        <Fragment>Identical content with <Var>same variable</Var> and{{ ' ' }}<Num :value="count" /></Fragment>
      </template>
      <template #version2>
        <Fragment>Identical content with <Var>same variable</Var> and{{ ' ' }}<Num :value="count" /></Fragment>
      </template>
      <template #different>
        <Fragment>Different content with <Var>other variable</Var> and{{ ' ' }}<Num :value="count + 1" /></Fragment>
      </template>
    </Branch>
  </T>
</template>
