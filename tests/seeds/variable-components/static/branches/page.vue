<script setup lang="ts">
import { Fragment } from 'vue';
import { Branch, T } from 'gt-vue';

const derived = 'fn2';
const selection = 'yes';
</script>

<template><T>Hello there<Branch :branch="derived"><template #fn2><Fragment>Hello my good friend<span>fn1 hi fn2</span><Branch :branch="selection" other="yo"><template #yes><Fragment>yes</Fragment></template><template #no><Fragment>no</Fragment></template></Branch></Fragment></template><template #nope><Fragment>Hello my good friend<span>fn1 hi nope</span><Branch :branch="selection" other="yo"><template #yes><Fragment>yes</Fragment></template><template #no><Fragment>no</Fragment></template></Branch></Fragment></template><template #no><Fragment>Hello my good friend<span>no</span><Branch :branch="selection" other="yo"><template #yes><Fragment>yes</Fragment></template><template #no><Fragment>no</Fragment></template></Branch></Fragment></template></Branch></T></template>
