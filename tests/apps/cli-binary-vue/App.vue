<script setup lang="ts">
import { Branch, Plural, T } from 'gt-vue';
</script>

<template>
  <T context="native Bun &amp; browser compiler">
    <p title="Tea &amp; biscuits &notit">Rock&nbsp;&amp; roll &#x1f37d;</p>
    <Plural
      :n="1"
      :zero="0"
      :one="1"
      :two="-1"
      :few="3.14159"
      :many="1e6"
      :other="0xff"
    />
    <Branch
      branch="status"
      :active="true"
      :inactive="false"
      :unknown="null"
      pending=""
    />
    <Plural
      :n="1"
      singular="Single 'quotes' inside"
      plural='Double "quotes" inside'
      other="Template with 'both' &quot;types&quot;"
    />
  </T>
</template>
