<script setup lang="ts">
import { Branch, Plural, T } from 'gt-vue';
</script>

<template>
  <T>
    <Plural
      :n="1"
      singular="Line1\nLine2\tTabbed"
      plural="Special: !@#$%^&amp;*()_+-=[]{}|;:,.&lt;&gt;?"
      other="Template with ${variable} and `backticks`"
    />
    <Branch
      branch="language"
      english="Hello World"
      spanish="Hola Mundo ñáéíóú"
      chinese="你好世界"
      emoji="🌍🌎🌏 Hello 👋"
      arabic="مرحبا بالعالم"
      russian="Привет мир"
    />
    <Plural :n="1" singular="simple template" plural="another simple template" />
    <Branch
      branch="format"
      single="single line"
      :multi="'\n            line 1\n            line 2\n            line 3\n          '"
    />{{ '   ' }}
  </T>
</template>
