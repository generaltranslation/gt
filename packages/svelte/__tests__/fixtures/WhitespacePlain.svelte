<script lang="ts">
  import { Branch, Num, Plural } from 'gt-svelte';
  import Passthrough from './Passthrough.svelte';
  let { count = 1, status = 'active' }: { count?: number; status?: string } =
    $props();
</script>

<div>Price:<Passthrough> free</Passthrough></div>
<div><Passthrough>Read the docs </Passthrough><a href="/docs">here</a></div>
<div><Passthrough> Hello </Passthrough></div>
<div>[<Passthrough>   </Passthrough>]</div>
<div><Passthrough>Click<a href="/x"> here </a>to continue</Passthrough></div>
<div><Passthrough>Hello <b>world </b>again</Passthrough></div>
<div><Passthrough>x<b> </b>y</Passthrough></div>
<div><Passthrough>Run <code>  npm  i  </code> now</Passthrough></div>
<div><Passthrough><Num value={count} /><Plural n={count}>{#snippet one()} item{/snippet}{#snippet other()} items{/snippet}</Plural></Passthrough></div>
<div><Passthrough>Status:<Branch branch={status}>{#snippet active()} <i>active</i>{/snippet}unknown</Branch></Passthrough></div>
<div><Passthrough><Branch branch={status}>Hello </Branch>world</Passthrough></div>
<div><Passthrough>&#32;Hello&#32;</Passthrough></div>
<div><Passthrough>a&#13;<b>b</b></Passthrough></div>
<div><Passthrough>foo&#9;bar&#32;
  baz</Passthrough></div>
<div><Passthrough><b>x</b>
  &#10;
  <i>y</i></Passthrough></div>
<div><Passthrough><b>x</b>&#9;
  <i>y</i></Passthrough></div>
<div><Passthrough>
  Hello
    world
</Passthrough></div>
<div><Passthrough>a <!-- c --> b</Passthrough></div>
<div><Passthrough>Hello{' '}</Passthrough></div>
<div><Passthrough>Tom &amp; Jerry &lt;3</Passthrough></div>
<div>
  <Passthrough>
    You can make <Num value={7} /> of
    <Num value={50} />
    recipes
  </Passthrough>
</div>
<div>
  <Passthrough>
    Read the
    <a href="/docs">docs</a>
    today
  </Passthrough>
</div>
<div><pre><Passthrough>  a  <b> b </b>
  c  </Passthrough></pre></div>
<div><Passthrough><pre>
first
second</pre></Passthrough></div>
<div><Passthrough><span>a&#13;b</span></Passthrough></div>
<div><Passthrough><svg><text>a</text>
<text>b</text></svg></Passthrough></div>
