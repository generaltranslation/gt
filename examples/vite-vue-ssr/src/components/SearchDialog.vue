<script setup lang="ts">
import { computed, ref } from 'vue';
import { Num, Plural, T, useGT } from 'gt-vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const gt = useGT();
const query = ref('');
const resultCount = computed(() => (query.value.trim() ? 2 : 0));
</script>

<template>
  <Teleport to="#teleports">
    <Transition name="fade">
      <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
        <section
          class="search-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="gt('Documentation search')"
        >
          <button
            class="dialog-close"
            type="button"
            :aria-label="gt('Close search')"
            @click="emit('close')"
          >
            ×
          </button>
          <T context="search dialog introduction">
            <h2>Search documentation</h2>
            <p>Find any guide or API endpoint.</p>
          </T>
          <label for="docs-search">{{ gt('Search') }}</label>
          <input
            id="docs-search"
            v-model="query"
            autofocus
            :placeholder="gt('Search all documentation')"
          />
          <p class="result-count" role="status">
            <T context="search result count">
              <Plural :n="resultCount">
                <template #zero>No results yet</template>
                <template #one>One result</template>
                <template #other>
                  <Num :value="resultCount" />
                  results
                </template>
              </Plural>
            </T>
          </p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
