<script lang="ts">
import { msg } from 'gt-vue';

export const normalMessage = msg('Normal {literal}', { $context: 'normal' });
</script>

<script setup lang="ts">
import {
  Branch,
  Currency,
  DateTime as When,
  Num,
  Plural,
  T as Translate,
  Var as Value,
  msg as defineMessage,
  useGT as useTranslate,
  useMessages,
} from 'gt-vue';

const gt = useTranslate();
const m = useMessages();
const alias = gt;
const greeting = gt('Hello {name}', { $context: 'greeting' });
const navigation = m('Navigation');
const list = defineMessage(['First', 'Second'] as const, { $context: 'list' });
const aliased = alias('Aliased call');
function shadowed(gt: (value: string) => string) {
  return gt('Not a GT call');
}
</script>

<template>
  <Translate context="hero">
    <p title="Greeting">
      Hello
      <Value>{{ name }}</Value>
      !
    </p>
    <Plural :n="count">
      <template #one>
        one
        <Value>{{ item }}</Value>
      </template>
      <template #other>
        other
        <Value>{{ item }}</Value>
      </template>
      fallback
      <Value>{{ item }}</Value>
    </Plural>
    <Branch :branch="tone" key="stable">
      <template #formal>
        formal
        <Value>{{ name }}</Value>
      </template>
      <template #casual>
        casual
        <Value>{{ name }}</Value>
      </template>
      fallback
      <Value>{{ name }}</Value>
    </Branch>
    <b>end</b>
    <Num :value="count" />
    <When :value="date" />
    <Currency :value="cost" />
    <var>native</var>
  </Translate>
  {{ gt('Template call', { $context: 'template' }) }}
  {{ m(defineMessage('Encoded message', { $context: 'encoded' })) }}
  <p :title="gt('Template title')" />
  <Some v-slot="{ gt }">{{ gt('Shadowed template call') }}</Some>
</template>
