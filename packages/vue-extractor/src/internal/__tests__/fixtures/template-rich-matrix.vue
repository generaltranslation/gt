<script setup lang="ts">
import {
  Branch as Choose,
  Currency,
  DateTime as When,
  Num,
  Plural,
  T as Translate,
  Var as Value,
} from 'gt-vue';

const cost = 12.5;
const count = 2;
const date = new Date('2026-01-01');
const name = 'Ada';
const tone = 'formal';
</script>

<template>
  <Translate context="matrix">
    <section title="Heading" aria-label="Greeting">
      Hello
      <strong>
        <Value>{{ name }}</Value>
      </strong>
      !
      <input placeholder="Your name" />
      <img alt="Portrait" aria-describedby="hint" />
      <Num :value="count" />
      <When :value="date" />
      <Currency :value="cost" />
      <var>native</var>
      <Choose :branch="tone" formal="Ignored because the slot wins">
        <template #formal>
          Formal
          <Value>{{ name }}</Value>
        </template>
        <template #casual>
          Casual
          <Value>{{ name }}</Value>
        </template>
        Fallback
        <Value>{{ name }}</Value>
      </Choose>
      <Plural :n="count" zero="None">
        <template #one>
          One
          <Value>{{ count }}</Value>
        </template>
        <template #other>
          Many
          <Value>{{ count }}</Value>
        </template>
        Fallback
        <Value>{{ count }}</Value>
      </Plural>
    </section>
  </Translate>
</template>
