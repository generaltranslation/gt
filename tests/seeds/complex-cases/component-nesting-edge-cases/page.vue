<script setup lang="ts">
import { Branch, Currency, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100.5;
const count = 5;
</script>

<template>
  <T>
    <Branch branch="structure" flat="Simple flat content">
      <template #nested>
        <div>
          <Plural :n="count">
            <template #singular>
              <span>
                Nested plural:
                <Var>single</Var>
              </span>
            </template>
            <template #plural>
              <Branch branch="inner" option1="Double nested!">
                <template #option2>
                  <Fragment>
                    With
                    <Currency :value="amount" currency="USD" />
                  </Fragment>
                </template>
              </Branch>
            </template>
          </Plural>
        </div>
      </template>
    </Branch>
  </T>
</template>
