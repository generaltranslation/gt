<script setup lang="ts">
import { Branch, Plural, T, Var } from 'gt-vue';
</script>

<template>
  <T>
    <Branch branch="level1" option2="level1 option2">
      <template #option1>
        <Plural :n="1" _2="level1 plurals">
          <template #_1>
            <Branch branch="level2" option2="level2 option2">
              <template #option1>
                <Plural :n="1" _2="level2 plurals">
                  <template #_1>
                    <Branch branch="level3" option2="level3 option2">
                      <template #option1>
                        <Plural :n="1" _2="deep files">
                          <template #_1><Var>deeply nested variable</Var></template>
                        </Plural>
                      </template>
                    </Branch>
                  </template>
                </Plural>
              </template>
            </Branch>
          </template>
        </Plural>
      </template>
    </Branch>
  </T>
</template>
