<script setup lang="ts">
import { Fragment } from 'vue';
import { Select, T } from 'gt-vue';

const derived = 'fn2';
const selection = 'yes';
</script>

<template><T>Hello there<Select :value="derived"><template #fn2><Fragment>Hello my good friend<span>fn1 hi fn2</span><Select :value="selection"><template #yes><Fragment>yes</Fragment></template><template #no><Fragment>no</Fragment></template><template #default>yo</template></Select></Fragment></template><template #nope><Fragment>Hello my good friend<span>fn1 hi nope</span><Select :value="selection"><template #yes><Fragment>yes</Fragment></template><template #no><Fragment>no</Fragment></template><template #default>yo</template></Select></Fragment></template><template #no><Fragment>Hello my good friend<span>no</span><Select :value="selection"><template #yes><Fragment>yes</Fragment></template><template #no><Fragment>no</Fragment></template><template #default>yo</template></Select></Fragment></template></Select></T></template>
