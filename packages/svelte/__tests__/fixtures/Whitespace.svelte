<script lang="ts">
  import { Branch, Num, Plural, T } from 'gt-svelte';
  let { count = 1, status = 'active' }: { count?: number; status?: string } =
    $props();
</script>

<div>Price:<T> free</T></div>
<div><T>Read the docs </T><a href="/docs">here</a></div>
<div><T> Hello </T></div>
<div>[<T>   </T>]</div>
<div><T>Click<a href="/x"> here </a>to continue</T></div>
<div><T>Hello <b>world </b>again</T></div>
<div><T>x<b> </b>y</T></div>
<div><T>Run <code>  npm  i  </code> now</T></div>
<div><T><Num value={count} /><Plural n={count}>{#snippet one()} item{/snippet}{#snippet other()} items{/snippet}</Plural></T></div>
<div><T>Status:<Branch branch={status}>{#snippet active()} <i>active</i>{/snippet}unknown</Branch></T></div>
<div><T><Branch branch={status}>Hello </Branch>world</T></div>
<div><T>&#32;Hello&#32;</T></div>
<div><T>a&#13;<b>b</b></T></div>
<div><T>foo&#9;bar&#32;
  baz</T></div>
<div><T><b>x</b>
  &#10;
  <i>y</i></T></div>
<div><T><b>x</b>&#9;
  <i>y</i></T></div>
<div><T>
  Hello
    world
</T></div>
<div><T>a <!-- c --> b</T></div>
<div><T>Hello{' '}</T></div>
<div><T>Tom &amp; Jerry &lt;3</T></div>
<div>
  <T>
    You can make <Num value={7} /> of
    <Num value={50} />
    recipes
  </T>
</div>
<div>
  <T>
    Read the
    <a href="/docs">docs</a>
    today
  </T>
</div>
<div><pre><T>  a  <b> b </b>
  c  </T></pre></div>
<div><T><pre>
first
second</pre></T></div>
<div><T><span>a&#13;b</span></T></div>
<div><T><svg><text>a</text>
<text>b</text></svg></T></div>
<div><T><pre>
first{'second'}</pre></T></div>
<div><T>a&#13;b</T></div>
