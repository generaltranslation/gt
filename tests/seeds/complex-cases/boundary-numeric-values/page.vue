<script setup lang="ts">
import { Plural, T } from 'gt-vue';

const count = 5;
</script>

<template>
  <T>
    <Plural
      :n="count"
      :zero="0.0"
      :one="1e-323"
      :two="5e-324"
      :few="1.7976931348623157e308"
      :many="-1.7976931348623157e308"
      :other="2.2250738585072014e-308"
    />
  </T>
</template>
