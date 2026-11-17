<script setup lang="ts">
import { msg, useGT, useMessages } from 'gt-vue';

const t = useGT();
const messages = useMessages();
const runtimeValue = String(Date.now());

t(`Dynamic ${runtimeValue}`);
messages(runtimeValue);

const dynamicOptions = { $context: runtimeValue };
t('Dynamic options', dynamicOptions);

msg?.('Optional direct msg');

function receivesTranslator(translator: typeof t) {
  return translator('Passed callback');
}
void receivesTranslator;

const conditional = Date.now() > 0 ? t : String;
conditional('Conditional callback');
</script>
