<script setup lang="ts">
import { Select, Plural, T, Var } from 'gt-vue';
</script>

<template>
  <T>
    <Select value="level1" option2="level1 option2">
      <template #option1>
        <Plural :n="1" _2="level1 plurals">
          <template #_1>
            <Select value="level2" option2="level2 option2">
              <template #option1>
                <Plural :n="1" _2="level2 plurals">
                  <template #_1>
                    <Select value="level3" option2="level3 option2">
                      <template #option1>
                        <Plural :n="1" _2="deep files">
                          <template #_1><Var>deeply nested variable</Var></template>
                        </Plural>
                      </template>
                    </Select>
                  </template>
                </Plural>
              </template>
            </Select>
          </template>
        </Plural>
      </template>
    </Select>
  </T>
</template>
