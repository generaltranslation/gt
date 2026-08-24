<script setup lang="ts">
import { msg, useGT, useMessages } from 'gt-vue';

const gt = useGT();
const messages = useMessages();
const runtimeValue = String(Date.now());

gt(`Dynamic ${runtimeValue}`);
messages(runtimeValue);

const dynamicOptions = { $context: runtimeValue };
gt('Dynamic options', dynamicOptions);

msg?.('Optional direct msg');

function receivesTranslator(translator: typeof gt) {
  return translator('Passed callback');
}
void receivesTranslator;

const conditional = Date.now() > 0 ? gt : String;
conditional('Conditional callback');
</script>
