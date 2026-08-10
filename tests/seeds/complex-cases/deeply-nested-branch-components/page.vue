<script setup lang="ts">
import { Branch, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const location = 'home';
</script>

<template>
  <T>
    <Branch :branch="location" work="At the office">
      <template #home>
        <Branch branch="time" morning="Good morning at home">
          <template #evening>
            <Fragment>
              Good evening at
              <Var>home</Var>
              with {{ ' ' }}
              <Branch branch="weather" sunny="sunny skies" rainy="rainy weather" />
            </Fragment>
          </template>
        </Branch>
      </template>
    </Branch>
  </T>
</template>
