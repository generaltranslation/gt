<script lang="ts">
  import { T, gt } from 'gt-svelte';
  import LocaleSwitcher from '../../components/LocaleSwitcher.svelte';
</script>

<main>
  <h1>{gt('About')}</h1>
  <p data-testid="about">
    <T>This page was reached by <em>client-side navigation</em>.</T>
  </p>
  <a href="/">{gt('Home')}</a>
  <LocaleSwitcher />
</main>
