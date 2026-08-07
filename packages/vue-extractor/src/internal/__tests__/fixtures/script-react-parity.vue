<script setup lang="ts">
import {
  T as ImportedT,
  msg as importedMsg,
  useGT as createGT,
  useMessages as createMessages,
} from 'gt-vue';

type Translator = ReturnType<typeof createGT>;

const hookAlias = createGT;
const translate = hookAlias();
const firstAlias = translate;
const secondAlias = (firstAlias as Translator)!;

const framework = 'Vue';
const suffix = ' parity' as const;
secondAlias(`Hello, ${framework}${suffix}`);
secondAlias('Count ' + -2 + ' / ' + true + ' / ' + null);

const wrappedMessage = 'Wrapped static' satisfies string as string;
secondAlias(wrappedMessage);

const stableMessage = importedMsg;
stableMessage('Aliased msg');

const messages = createMessages();
const rawTitle = 'Raw messages identifier';
messages(rawTitle);

(hookAlias as typeof createGT)()('Wrapped direct hook call');
createGT()?.('Optional direct hook call');

// oxlint-disable-next-line prefer-const -- exercises a post-declaration object assignment flow
let objectAssigned: Translator;
({ translator: objectAssigned } = { translator: createGT() });
objectAssigned('Object assignment flow');

// oxlint-disable-next-line prefer-const -- exercises a post-declaration array assignment flow
let arrayAssigned: Translator;
[arrayAssigned] = [createGT()];
arrayAssigned('Array assignment flow');

const LocalT = (ImportedT as typeof ImportedT)!;

{
  const importedMsg = String;
  importedMsg('Shadowed local binding');
}

function shadowParameter(importedMsg: typeof stableMessage) {
  return importedMsg('Shadowed parameter binding');
}
void shadowParameter;

let mutableMessage = importedMsg;
mutableMessage = ((source: string) => source) as typeof importedMsg;
mutableMessage('Reassigned alias');
</script>

<template>
  <LocalT>Wrapped component alias</LocalT>
</template>
