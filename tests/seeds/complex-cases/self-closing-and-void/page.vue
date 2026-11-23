<script setup lang="ts">
import { Select, Num, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const count = 5;
</script>

<template>
  <T>
    <Select value="type">
      <template #line>
        <Fragment><hr />Line break<br />New line</Fragment>
      </template>
      <template #image>
        <Fragment><img src="test.jpg" alt="Test" />Image with <Var>caption</Var></Fragment>
      </template>
      <template #input>
        <Fragment><input type="text" placeholder="Input" />Field with <Num :value="count" /></Fragment>
      </template>
    </Select>
  </T>
</template>
