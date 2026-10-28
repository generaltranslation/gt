<script lang="ts">
  import { useSetLocale } from 'gt-svelte';
  import Greeting from './Greeting.svelte';
  const setLocale = useSetLocale();
</script>

<button onclick={() => setLocale('fr')}>fr</button>
<Greeting name="Ada" />
