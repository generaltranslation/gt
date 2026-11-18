<script lang="ts">
  import { Num, T, Var, gt as translate } from 'gt-svelte';

  const { name, count }: { name: string; count: number } = $props();
  let clicks = $state(0);
</script>

<h1 title={translate('Greeting title')}>
  {translate('Welcome', { $context: 'page heading' })}
</h1>
<T>
  Hello <strong>wonderful <em>world</em></strong>.
</T>
<p><T>Hello <Var>{name}</Var>, you have <Num value={count} /> messages.</T></p>
<T context="call to action">
  Click <button onclick={() => clicks++}>here</button> to continue.
</T>
<output>{clicks}</output>
{#each ['shadowed'] as translate (translate)}<span>{translate}</span>{/each}
