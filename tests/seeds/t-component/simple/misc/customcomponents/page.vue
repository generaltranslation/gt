<script setup lang="ts">
import { defineComponent, h } from 'vue';
import { T } from 'gt-vue';

const Link = defineComponent({
  name: 'Link',
  props: {
    href: {
      required: true,
      type: String,
    },
  },
  setup(props, { slots }) {
    return () => h('a', { href: props.href }, slots.default?.());
  },
});

const Button = defineComponent({
  name: 'Button',
  setup(_props, { slots }) {
    return () => h('button', null, slots.default?.());
  },
});
</script>

<template><T>Let's see some custom components<Link href="https://www.google.com">Google</Link><Button>Click me</Button></T></template>
