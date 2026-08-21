<script setup lang="ts">
import { Branch, Currency, DateTime, Num, Plural, T } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100.5;
const count = 5;
const date = new Date();
</script>

<template>
  <T>
    <div class="container">
      <Plural :n="count">
        <template #singular>
          <div>You have <Num :value="count" /> item costing{{ ' ' }}<Currency :value="amount" currency="USD" />on <DateTime :value="date" /> in the<Branch branch="location" home="home folder">
              <template #work><Fragment>work directory</Fragment></template>
            </Branch></div>
        </template>
        <template #plural>
          <div>You have <Num :value="count" /> items costing{{ ' ' }}<Currency :value="amount * count" currency="USD" /><Fragment>fragments mixed</Fragment> with elements</div>
        </template>
      </Plural>
    </div>
  </T>
</template>
