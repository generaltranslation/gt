<script lang="ts">
  import { useGT, useLocale, msg, useMessages } from 'gt-svelte';
  const t = useGT();
  const m = useMessages();
  const locale = useLocale();
  const saved = msg('Saved');
</script>

<p class="gt">{t('Hello, {name}!', { name: 'Ada' })}</p>
<p class="msg">{m(saved)}</p>
<p class="locale">{locale.current}</p>
