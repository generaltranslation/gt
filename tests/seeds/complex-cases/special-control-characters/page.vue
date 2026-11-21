<script setup lang="ts">
import { Select, Plural, T } from 'gt-vue';
</script>

<template>
  <T>
    <Plural
      :n="1"
      _1="Line1\nLine2\tTabbed"
      _2="Special: !@#$%^&amp;*()_+-=[]{}|;:,.&lt;&gt;?">{{ 'Template with $\x7bvariable\x7d and `backticks`' }}</Plural>
    <Select
      value="language"
      english="Hello World"
      spanish="Hola Mundo ñáéíóú"
      chinese="你好世界"
      emoji="🌍🌎🌏 Hello 👋"
      arabic="مرحبا بالعالم"
      russian="Привет мир"
    />
    <Plural :n="1" _1="simple template" _2="another simple template" />
    <Select
      value="format"
      single="single line"
      :multi="'\n            line 1\n            line 2\n            line 3\n          '"
    />{{ '   ' }}
  </T>
</template>
