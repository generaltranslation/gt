<script setup lang="ts">
import { Branch, Plural, T, Var } from 'gt-vue';
</script>

<template>
  <T>
    <Branch branch="level1" option2="level1 option2">
      <template #option1>
        <Plural :n="1" plural="level1 plurals">
          <template #singular>
            <Branch branch="level2" option2="level2 option2">
              <template #option1>
                <Plural :n="1" plural="level2 plurals">
                  <template #singular>
                    <Branch branch="level3" option2="level3 option2">
                      <template #option1>
                        <Plural :n="1" plural="deep files">
                          <template #singular><Var>deeply nested variable</Var></template>
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
