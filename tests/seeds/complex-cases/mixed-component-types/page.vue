<script setup lang="ts">
import { Select, Currency, DateTime, Num, Plural, T } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100.5;
const count = 5;
const date = new Date();
</script>

<template>
  <T>
    <div class="container">
      <Plural :n="count">
        <template #_1>
          <div>You have <Num :value="count" /> item costing{{ ' ' }}<Currency :value="amount" currency="USD" />on <DateTime :value="date" /> in the<Select value="location" home="home folder">
              <template #work><Fragment>work directory</Fragment></template>
            </Select></div>
        </template>
        <template #_2>
          <div>You have <Num :value="count" /> items costing{{ ' ' }}<Currency :value="amount * count" currency="USD" /><Fragment>fragments mixed</Fragment> with elements</div>
        </template>
      </Plural>
    </div>
  </T>
</template>
