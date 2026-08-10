<script setup lang="ts">
import { Currency, Num, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100.5;
const count = 5;
</script>

<template>
  <T>
    <Plural :n="count">
      <template #singular>
        <Fragment>
          Outer fragment
          <Fragment>
            Nested fragment with
            <Var>variable</Var>
            <Fragment>
              Deep nested with
              <Num :value="count" />
              <Fragment>More nesting</Fragment>
            </Fragment>
          </Fragment>
          Back to outer
        </Fragment>
      </template>
      <template #plural>
        <div>
          <Fragment>Fragment in div</Fragment>
          <span>
            <Fragment>
              Fragment in span with {{ ' ' }}
              <Currency :value="amount" currency="USD" />
            </Fragment>
          </span>
        </div>
      </template>
    </Plural>
  </T>
</template>
