<script lang="ts">
  import { Num, T, Var, gt } from 'gt-svelte';
  import LocaleSwitcher from '../components/LocaleSwitcher.svelte';

  const user = 'Ada';
  let clicks = $state(0);
</script>

<svelte:head>
  <title>{gt('Svelte test app')}</title>
</svelte:head>

<main>
  <h1>{gt('Welcome to the Svelte test app', { $context: 'page heading' })}</h1>
  <p data-testid="greeting">
    <T context="inbox summary">
      Hello <strong><Var>{user}</Var></strong>, you have
      <Num value={1234} /> new messages.
    </T>
  </p>
  <p data-testid="counter">
    <T>
      You clicked <button onclick={() => clicks++}>this button</button>
      <Var>{clicks}</Var> times.
    </T>
  </p>
  <a href="/about">{gt('About this app')}</a>
  <LocaleSwitcher />
</main>
