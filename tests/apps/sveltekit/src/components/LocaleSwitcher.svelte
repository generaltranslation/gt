<script lang="ts">
  import { getGT, gt } from 'gt-svelte';

  const runtime = getGT();
</script>

<p data-testid="locale">{gt('Current locale')}: {runtime.locale}</p>
<button type="button" onclick={() => runtime.setLocale('en')}>English</button>
<button type="button" onclick={() => runtime.setLocale('fr')}>Français</button>
