<script lang="ts">
  import { T } from 'gt-svelte';
</script>

<div data-testid="native-svg"><svg><a href="/home"><text>Hello</text></a></svg></div>
<div data-testid="t-svg"><T><svg><a href="/home"><text>Hello</text></a></svg></T></div>
<div data-testid="native-math"><math><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math></div>
<div data-testid="t-math"><T><math><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math></T></div>
<div data-testid="native-pre"><pre>
first
  second</pre></div>
<div data-testid="t-pre"><T><pre>
first
  second</pre></T></div>
<div data-testid="native-nbsp">&nbsp;Spaced&nbsp;</div>
<div data-testid="t-nbsp"><T>&nbsp;Spaced&nbsp;</T></div>
<div data-testid="native-textarea"><textarea>Hello</textarea></div>
<div data-testid="t-textarea"><T><textarea>Hello</textarea></T></div>
