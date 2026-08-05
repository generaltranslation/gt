<script setup>
import { T, Var, msg, useGT, useMessages } from 'gt-vue';
import { computed, defineComponent, h, ref } from 'vue';

const gt = useGT();
const m = useMessages();
const nested = { deep: { gt, m } };
const gtRef = ref(gt);
const mComputed = computed(() => m);
const registeredMessage = msg('Registered message', {
  $context: 'navigation',
});

const registry = [T];
const exactT = registry[0];
const registeredComponents = { Featured: T };

const Card = defineComponent({
  name: 'SmokeCard',
  props: {
    title: {
      required: true,
      type: String,
    },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'section',
        { 'data-card': props.title },
        slots.default?.({ label: props.title })
      );
  },
});

function recordScopedSlot(slotProps) {
  window.__GT_SMOKE__.slotCalls += 1;
  return slotProps;
}
</script>

<template>
  <main>
    <!-- Translator note for the following message. -->
    <T context="safe-comment">Helloworld</T>

    <T context="preserved-whitespace">First second</T>

    <T context="opaque-owner">
      <Card title="Heading">
        <template #default="slotProps">
          <T context="scoped-slot">
            Scoped
            <Var>{{ recordScopedSlot(slotProps).label }}</Var>
          </T>
        </template>
      </Card>
      <p>After</p>
    </T>

    <component :is="exactT" context="exact-selector">Exact component</component>
    <component
      :is="registeredComponents.Featured"
      context="registered-selector"
    >
      Registered component
    </component>

    <p id="direct-gt">{{ gt('Direct GT') }}</p>
    <p id="nested-gt">{{ nested.deep.gt('Nested GT') }}</p>
    <p id="ref-gt">{{ gtRef('Ref GT') }}</p>
    <p id="nested-m">{{ nested.deep.m('Nested raw message') }}</p>
    <p id="computed-m">{{ mComputed('Computed raw message') }}</p>
    <p id="registered-message">{{ m(registeredMessage) }}</p>
  </main>
</template>
