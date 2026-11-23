<script setup lang="ts">
import { Select, Currency, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100.5;
const count = 5;
</script>

<template>
  <T>
    <Select value="structure" flat="Simple flat content">
      <template #nested>
        <div>
          <Plural :n="count">
            <template #_1>
              <span>Nested plural: <Var>single</Var></span>
            </template>
            <template #_2>
              <Select value="inner" option1="Double nested!">
                <template #option2>
                  <Fragment>With <Currency :value="amount" currency="USD" /></Fragment>
                </template>
              </Select>
            </template>
          </Plural>
        </div>
      </template>
    </Select>
  </T>
</template>
