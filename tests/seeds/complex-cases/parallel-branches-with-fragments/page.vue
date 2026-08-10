<script setup lang="ts">
import { Num, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';
</script>

<template>
  <T>
    <Plural :n="1">
      <template #singular>
        <Fragment>
          <Var>var1</Var>
          and
          <Num :value="1" />
        </Fragment>
      </template>
      <template #plural>
        <div>
          <Var>var1</Var>
          and
          <Num :value="1" />
        </div>
      </template>
    </Plural>
  </T>
</template>
