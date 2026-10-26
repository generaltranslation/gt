<script lang="ts">
  import { Plural, Num, T, Var, useGT, useLocale } from 'gt-svelte';
  import LocaleSelector from '$lib/LocaleSelector.svelte';

  const gt = useGT();
  const locale = useLocale();
  let count = $state(1);
  const name = 'Ada';
</script>

<main>
  <LocaleSelector />
  <h1>
    <T>Welcome to the <b>SvelteKit</b> test app</T>
  </h1>
  <p data-testid="locale">Locale: {locale.current}</p>
  <p data-testid="greeting">
    <T context="greeting">
      Hello, <Var>{name}</Var>! Read the <a href="/docs" title="Documentation">docs</a>.
    </T>
  </p>
  <p data-testid="plural">
    <T>
      <Plural n={count}>
        {#snippet one()}You have <b>one</b> message{/snippet}
        {#snippet other()}You have <b><Num value={count} /></b> messages{/snippet}
      </Plural>
    </T>
  </p>
  <button onclick={() => (count += 1)}>{gt('Add a message')}</button>
  <p data-testid="string">{gt('A string translated with useGT.')}</p>
</main>
