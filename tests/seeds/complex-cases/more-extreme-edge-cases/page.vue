<script setup lang="ts">
import { Fragment } from 'vue';
import { Branch, Currency, DateTime, Num, Plural, T, Var } from 'gt-vue';

const amount = 123.45;
const count = 7;
const date = new Date();
</script>

<template>
  <T>
    <Branch branch="test" option4="normal">
      <template #option1><Fragment>Start {{ '' }} middle {{ '' }} end</Fragment></template>
      <template #option2><Fragment>Before{{ '' }}{{ '' }}<Fragment />After</Fragment></template>
      <template #option3><Fragment>{{ '' }}<span>element</span>{{ '' }}</Fragment></template>
    </Branch>
    <Plural :n="count">
      <template #singular><Fragment>Text<Fragment />More text</Fragment></template>
      <template #plural><Fragment><Fragment>Fragment</Fragment>content</Fragment></template>
      <template #other><Fragment><Fragment /></Fragment></template>
    </Plural>
    <Branch branch="bool">
      <template #true_val><Fragment>{{ true }}</Fragment></template>
      <template #false_val><Fragment>{{ false }}</Fragment></template>
      <template #mixed_true><Fragment>Before {{ true }} after</Fragment></template>
      <template #mixed_false><Fragment>Before {{ false }} after</Fragment></template>
      <template #multiple><Fragment>{{ true }}{{ false }}{{ true }}</Fragment></template>
    </Branch>
    <Plural :n="1" other="normal">
      <template #zero><Fragment>{{ null }}</Fragment></template>
      <template #one><Fragment>{{ undefined }}</Fragment></template>
      <template #two><Fragment>{{ false }}</Fragment></template>
      <template #few><Fragment>{{ true }}{{ null }}{{ undefined }}</Fragment></template>
      <template #many><Fragment>Mixed {{ false }} and {{ null }}</Fragment></template>
    </Plural>
    <Branch
      branch="precision"
      :tiny="1e-324"
      :almost_zero="4.9e-324"
      :epsilon="2.220446049250313e-16"
      :almost_one="0.9999999999999999"
      :not_quite_two="1.9999999999999998"
      :close_to_pi="3.141592653589793"
    />
    <Plural :n="count" :zero="1.0" :one="1.0" :two="1.0" :few="5.0e10" :many="5.0e10" :other="5.0e-10" />
    <Branch branch="space">
      <template #zero_width><Fragment>word1​word2</Fragment></template>
      <template #thin_space><Fragment>word1 word2</Fragment></template>
      <template #hair_space><Fragment>word1 word2</Fragment></template>
      <template #figure_space><Fragment>word1 word2</Fragment></template>
      <template #punctuation_space><Fragment>word1 word2</Fragment></template>
      <template #normal><Fragment>word1 word2</Fragment></template>
    </Branch>
    <Plural :n="1">
      <template #singular><Fragment>Line1\nLine2</Fragment></template>
      <template #plural><Fragment>Line1\r\nLine2</Fragment></template>
      <template #other><Fragment>Line1\rLine2</Fragment></template>
    </Plural>
    <Branch branch="nested">
      <template #option1>
        <Fragment><Fragment><Fragment><Fragment><Fragment>Text</Fragment><Fragment /><Fragment>More</Fragment></Fragment></Fragment><span>Element</span></Fragment><Fragment>Final</Fragment></Fragment>
      </template>
      <template #option2><Fragment><Fragment><Fragment><Fragment><Fragment>Flat</Fragment></Fragment>&nbsp;</Fragment></Fragment></Fragment></template>
    </Branch>
    <Plural :n="count">
      <template #singular><Fragment><Fragment />Content<Fragment />More<Fragment />End</Fragment></template>
      <template #plural><Fragment>Start<Fragment />Middle<Fragment />End</Fragment></template>
      <template #other><Fragment><Fragment />Text<Fragment><Fragment /></Fragment></Fragment></template>
    </Plural>
    <Branch branch="names" option2="normal">
      <template #option1><Fragment><Var></Var><Var></Var><Var></Var><Var></Var><Var></Var><Var></Var><Var></Var></Fragment></template>
    </Branch>
    <Plural :n="1">
      <template #singular>
        <Fragment><Var>v1</Var><Num value="1" /><Currency value="1" currency="USD" /><DateTime :value="new Date(2023)" /><Var>v2</Var><Num value="2" /><Currency value="2" currency="EUR" /><DateTime :value="new Date(2023)" /><Var>v3</Var><Num value="3" /><Currency value="3" currency="JPY" /><DateTime :value="new Date(2023)" /></Fragment>
      </template>
      <template #plural>
        <Fragment><DateTime :value="new Date(2023)" /><Currency value="3" currency="JPY" /><Num value="3" /><Var>v3</Var><DateTime :value="new Date(2023)" /><Currency value="2" currency="EUR" /><Num value="2" /><Var>v2</Var><DateTime :value="new Date(2023)" /><Currency value="1" currency="USD" /><Num value="1" /><Var>v1</Var></Fragment>
      </template>
    </Plural>
    <Plural :n="1" singular="é" plural="é" other="ñ vs ñ" />
    <Branch
      branch="emoji"
      basic="👍"
      skin_tone="👍🏽"
      zwj_sequence="👨‍👩‍👧‍👦"
      flag="🇺🇸"
      text_vs_emoji="©️ vs ©"
    />
    <Plural :n="1" singular="\x41" plural="\u0041" other="\101" />
    <Branch
      branch="many"
      a1="1"
      a2="2"
      a3="3"
      a4="4"
      a5="5"
      a6="6"
      a7="7"
      a8="8"
      a9="9"
      a10="10"
      b1="1"
      b2="2"
      b3="3"
      b4="4"
      b5="5"
      b6="6"
      b7="7"
      b8="8"
      b9="9"
      b10="10"
      c1="1"
      c2="2"
      c3="3"
      c4="4"
      c5="5"
      c6="6"
      c7="7"
      c8="8"
      c9="9"
      c10="10"
      d1="1"
      d2="2"
      d3="3"
      d4="4"
      d5="5"
      d6="6"
      d7="7"
      d8="8"
      d9="9"
      d10="10"
      e1="1"
      e2="2"
      e3="3"
      e4="4"
      e5="5"
      e6="6"
      e7="7"
      e8="8"
      e9="9"
      e10="10"
    />
    <Branch branch="outer">
      <template #path1>
        <Branch branch="inner">
          <template #option1><Fragment><Var>shared1</Var><Num value="shared2" /><Branch branch="deepest"><template #a><Var>deep1</Var></template><template #b><Var>deep2</Var></template></Branch></Fragment></template>
          <template #option2><Fragment><Var>shared1</Var><Num value="shared2" /><Branch branch="deepest"><template #a><Var>deep1</Var></template><template #b><Var>deep2</Var></template></Branch></Fragment></template>
        </Branch>
      </template>
      <template #path2>
        <Branch branch="inner">
          <template #option1><Fragment><Var>shared1</Var><Num value="shared2" /><Branch branch="deepest"><template #a><Var>deep1</Var></template><template #b><Var>deep2</Var></template></Branch></Fragment></template>
          <template #option2><Fragment><Var>shared1</Var><Num value="shared2" /><Branch branch="deepest"><template #a><Var>deep1</Var></template><template #b><Var>deep2</Var></template></Branch></Fragment></template>
        </Branch>
      </template>
    </Branch>
    <Plural :n="count" :zero="0" :one="1" :two="-1" :few="Infinity" :other="NaN" />
    <Branch
      branch="json"
      object='{"key": "value"}'
      array="[1, 2, 3]"
      nested='{"a": {"b": [1, {"c": true}]}}'
      escaped='{"quote": "He said \\"hello\\""}'
    />
    <Plural :n="count">
      <template #singular>
        <Fragment>Text content<Fragment>Nested fragment with <Var>variable1</Var><Fragment>Deeply nested with <Num :value="count" /><Fragment /><span>Element</span><Fragment>Final nested</Fragment></Fragment></Fragment>Back to top level</Fragment>
      </template>
      <template #plural>
        <div><Fragment>Fragment in div</Fragment> with <Var>variable2</Var><span><Fragment>Deep fragment with{{ ' ' }}<Currency :value="amount" currency="USD" /></Fragment>{{ null }}{{ undefined }}{{ false }}</span></div>
      </template>
    </Plural>
    <Branch branch="complex" option2="Simple option for comparison">
      <template #option1>
        <Fragment>Start {{ true }} {{ false }} {{ null }} {{ undefined }}{{ '' }} <Fragment />
          <Plural :n="count">
            <template #zero><Fragment>Zero with <Var>var1</Var></Fragment></template>
            <template #one><Fragment>One with <Num :value="count" /> {{ NaN }}</Fragment></template>
            <template #two><Fragment>Two with{{ ' ' }}<Currency :value="amount" currency="USD" />{{ ' ' }}{{ Infinity }}</Fragment></template>
            <template #few><Fragment>Few with <DateTime :value="date" /></Fragment></template>
            <template #many><Branch branch="nested"><template #c><Fragment>{{ 0xff }} and {{ 0o755 }} and {{ 0b1111 }}</Fragment></template></Branch></template>
            <template #other><Fragment>Other {{ +0 }} vs {{ -0 }}{{ +1 }} vs {{ -1 }}</Fragment></template>
          </Plural>
          End {{ '' }}<Fragment />
        </Fragment>
      </template>
    </Branch>
  </T>
</template>
