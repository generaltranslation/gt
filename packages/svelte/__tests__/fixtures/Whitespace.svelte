<script lang="ts">
  import { Branch, Num, Plural, T } from 'gt-svelte';
  let { count = 1, status = 'active' }: { count?: number; status?: string } =
    $props();
</script>

<p>Price:<T> free</T></p>
<p><T>Read the docs </T><a href="/docs">here</a></p>
<p><T> Hello </T></p>
<p>[<T>   </T>]</p>
<p><T>Click<a href="/x"> here </a>to continue</T></p>
<p><T>Hello <b>world </b>again</T></p>
<p><T>x<b> </b>y</T></p>
<p><T>Run <code>  npm  i  </code> now</T></p>
<p><T><Num value={count} /><Plural n={count}>{#snippet one()} item{/snippet}{#snippet other()} items{/snippet}</Plural></T></p>
<p><T>Status:<Branch branch={status}>{#snippet active()} <i>active</i>{/snippet}unknown</Branch></T></p>
<p><T><Branch branch={status}>Hello </Branch>world</T></p>
<p><T>&#32;Hello&#32;</T></p>
<p><T>a&#13;<b>b</b></T></p>
<p><T>foo&#9;bar&#32;
  baz</T></p>
<p><T><b>x</b>
  &#10;
  <i>y</i></T></p>
<p><T><b>x</b>&#9;
  <i>y</i></T></p>
<p><T>
  Hello
    world
</T></p>
<p><T>a <!-- c --> b</T></p>
<p><T>Hello{' '}</T></p>
<p><T>Tom &amp; Jerry &lt;3</T></p>
