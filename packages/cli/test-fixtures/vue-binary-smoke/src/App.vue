<script setup lang="ts">
import { T, Var, useGT } from 'gt-vue';
import { defineComponent, h } from 'vue';

const gt = useGT();
const name = 'Ada';
const Card = defineComponent({
  name: 'Card',
  props: { title: { required: true, type: String } },
  setup(props, { slots }) {
    return () => h('section', slots.default?.({ label: props.title }));
  },
});
</script>

<template>
  <T context="outer">
    <Card title="Heading">
      <template #default="{ label }">
        <T context="inner">
          Nested
          <Var>{{ label }}</Var>
        </T>
      </template>
    </Card>
    <p>After</p>
  </T>
  <p>{{ gt('Binary string') }}</p>
</template>
