<script setup>
import * as GT from 'gt-vue';

const gt = GT.useGT();
const LocalT = GT.T;
gt('Namespace hook');
GT.msg('Namespace message');
GT['useGT']()('Computed namespace hook');
GT['msg']('Computed namespace message');
</script>

<template>
  <LocalT>Namespace alias component</LocalT>
  <GT.T>Namespace component</GT.T>
</template>
