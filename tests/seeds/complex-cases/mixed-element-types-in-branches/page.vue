<script setup lang="ts">
import { Currency, DateTime, Num, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100.5;
const count = 5;
const date = new Date();
</script>

<template>
  <T>
    <Plural :n="count">
      <template #singular>
        <article>
          <h1>Single Item</h1>
          <p>Description with <Var>details</Var></p>
          <footer>
            <Fragment>Footer with <Currency :value="amount" currency="USD" /><span>and <DateTime :value="date" /></span></Fragment>
          </footer>
        </article>
      </template>
      <template #plural>
        <section>
          <header>
            <h2><Num :value="count" /> Items</h2>
          </header>
          <main>
            <Fragment><p>Multiple items totaling{{ ' ' }}<Currency :value="amount * count" currency="USD" /></p>
              <ul>
                <li>Item with <Var>variable</Var></li>
              </ul>
            </Fragment>
          </main>
        </section>
      </template>
    </Plural>
  </T>
</template>
