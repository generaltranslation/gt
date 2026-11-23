<script setup lang="ts">
import { Select, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const location = 'home';
</script>

<template>
  <T>
    <Select :value="location" work="At the office">
      <template #home>
        <Select value="time" morning="Good morning at home">
          <template #evening>
            <Fragment>Good evening at <Var>home</Var> with{{ ' ' }}<Select value="weather" sunny="sunny skies" rainy="rainy weather" /></Fragment>
          </template>
        </Select>
      </template>
    </Select>
  </T>
</template>
