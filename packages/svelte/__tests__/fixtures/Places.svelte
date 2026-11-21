<script lang="ts">
  import { T, Num, Ordinal } from 'gt-svelte';

  let { n = 0 }: { n?: number } = $props();
</script>

<p class="bare">
  <Ordinal {n} _1="winner" one="first" two="second" few="third">later</Ordinal>
</p>
<p class="rich">
  <T
    ><Ordinal {n}
      >{#snippet one()}<Num value={n} />st{/snippet}{#snippet two()}<Num
          value={n}
        />nd{/snippet}{#snippet few()}<Num value={n} />rd{/snippet}<Num
        value={n}
      />th</Ordinal
    ></T
  >
</p>
<p class="place">
  <T><Ordinal {n} one="first" two="second">later</Ordinal></T>
</p>
