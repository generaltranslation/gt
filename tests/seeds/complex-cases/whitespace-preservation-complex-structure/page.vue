<script setup lang="ts">
import { Select, T, Var } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Select value="format">
      <template #compact>
        <Fragment>No spaces<Var>here</Var>at all</Fragment>
      </template>
      <template #spaced>
        <Fragment>{{ ' ' }}Lots of spaces <Var> here </Var> everywhere{{ ' ' }}</Fragment>
      </template>
      <template #mixed>
        <Fragment>Text<span> embedded spaces </span>more text<Var> padded var </Var>final text</Fragment>
      </template>
    </Select>
  </T>
</template>
