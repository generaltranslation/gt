<script setup lang="ts">
import { T, T as T2, msg, useGT, useMessages } from 'gt-vue';

type GTFunction = ReturnType<typeof useGT>;
const first = 'A';
const second = 'B' as const;
const gt = useGT() as GTFunction;
const m = useMessages();
const title = 'Static message';
const LocalT = T as typeof T;

gt(first + second);
gt(`BigInt ${1n}`);
gt('Typed context', { $context: 'typed' } as const);
gt('Satisfies context', {
  $context: 'satisfies',
} satisfies { $context: string });
gt('Static satisfies' satisfies string);
m(title);
useGT()('Direct hook call');
gt?.('Optional call');
gt!('Non-null call');

// oxlint-disable-next-line prefer-const -- exercises a post-declaration assignment flow
let assigned;
assigned = useGT();
assigned('Assigned hook result');

const [arrayGT] = [useGT()];
arrayGT('Array destructured hook result');
const { objectGT } = { objectGT: useGT() };
objectGT('Object destructured hook result');

let reassigned = msg;
reassigned = String;
reassigned('Not a GT message');
</script>

<template>
  <LocalT>Typed component alias</LocalT>
  <t-2>Digit component alias</t-2>
</template>
