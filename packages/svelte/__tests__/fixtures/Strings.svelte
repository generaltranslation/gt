<script lang="ts">
  import { useGT, useLocale, msg, useMessages } from 'gt-svelte';
  const gt = useGT();
  const m = useMessages();
  const locale = useLocale();
  const saved = msg('Saved');
</script>

<p class="gt">{gt('Hello, {name}!', { name: 'Ada' })}</p>
<p class="msg">{m(saved)}</p>
<p class="locale">{locale.current}</p>
