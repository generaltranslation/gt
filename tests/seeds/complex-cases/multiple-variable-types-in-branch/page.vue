<script setup lang="ts">
import { Currency, DateTime, Num, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100.5;
const count = 5;
const date = new Date(0);
</script>

<template>
  <T>
    <Plural :n="count">
      <template #singular>
        <Fragment>
          Transaction:
          <Currency :value="amount" currency="USD" />
          on {{ ' ' }}
          <DateTime :value="date" />
          for
          <Num :value="0.15" />
          tax with {{ ' ' }}
          <Var>REF-123</Var>
        </Fragment>
      </template>
      <template #plural>
        <div>
          <Currency :value="amount * count" currency="EUR" />
          total from {{ ' ' }}
          <Num :value="count" />
          transactions on
          <DateTime :value="date" />
        </div>
      </template>
    </Plural>
  </T>
</template>
