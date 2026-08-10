<script setup lang="ts">
import { Branch, Currency, DateTime, Num, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const count = 42;
const price = 9.99;
const timestamp = new Date(0);
</script>

<template>
  <T>
    <Plural :n="1">
      <template #singular>{{ ' ' }}</template>
      <template #plural>{{ '\t' }}</template>
    </Plural>
    <span>start</span>
    <span>middle</span>
    <span>end</span>
    <Plural :n="1" plural="files">
      <template #singular>
        <Fragment>
          <Fragment><Fragment>deep fragment nesting</Fragment></Fragment>
        </Fragment>
      </template>
    </Plural>
    <Branch branch="mixed" option2="simple">
      <template #option1>
        <Fragment>
          text
          <span>element</span>
          {{ 42 }}{{ true }}{{ null }}more text
        </Fragment>
      </template>
    </Branch>
    <Plural
      :n="1"
      :zero="0.0"
      :one="-0"
      :two="999999999999"
      :few="-999999999999"
      :many="0.000000001"
      :other="-0.000000001"
    />
    <Branch
      branch="floats"
      :tiny="0.1"
      :precise="3.141592653589793"
      :scientific="1.23e-10"
      :big-scientific="1.23e10"
    />
    <Branch branch="hex" :small="0x1" :medium="0xabc" :large="0xdeadbeef" :mixed="0x123abc" />
    <Plural
      :n="1"
      singular="Quotes: &quot; and '"
      plural="Backslashes: \ and \n and \t"
      other="Unicode: \u0041 and \x41"
    />
    <Branch
      branch="raw"
      json='{"key": "value", "array": [1,2,3]}'
      regex="/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/"
      path="C:\Program Files\App\file.exe"
    />
    <Plural :n="1" :zero="false" :one="true" :two="null" few="" :many="0" other="false" />
    <Branch
      branch="booleans"
      :truthy="true"
      :falsy="false"
      :nullish="null"
      empty=""
      :zero="0"
      string-true="true"
      string-false="false"
    />
    <Plural
      :n="1"
      singular="Template with ${escaped} and `backticks`"
      plural="Multi line template literal"
      other="Mixed &quot;quotes&quot; and 'apostrophes' in template"
    />
    <Plural
      :n="count"
      zero=""
      one="1"
      two="2"
      few="few"
      many="many"
      other="other"
      singular="sing"
      plural="plur"
    />
    <Branch
      branch="many_options"
      a="option a"
      b="option b"
      c="option c"
      d="option d"
      e="option e"
      :h="42"
      :i="true"
      :j="null"
    >
      <template #f><Fragment>fragment f</Fragment></template>
      <template #g><span>element g</span></template>
    </Branch>
    <Var>underscore content</Var>
    <Var>camel case content</Var>
    <Num :value="42" />
    <Num :value="-42" />
    <Num :value="3.14159" />
    <Currency :value="price" currency="USD" />
    <Currency :value="1234.56" currency="EUR" />
    <Currency :value="1000" currency="JPY" />
    <DateTime :value="timestamp" />
    <DateTime :value="0" />
    <Branch branch="l1" option2="l1 end">
      <template #option1>
        <Plural :n="1" plural="l1 plural">
          <template #singular>
            <Branch branch="l2" option2="l2 end">
              <template #option1>
                <Plural :n="1" plural="l2 plural">
                  <template #singular>
                    <Branch branch="l3" option2="l3 end">
                      <template #option1><Var>maximum depth</Var></template>
                    </Branch>
                  </template>
                </Plural>
              </template>
            </Branch>
          </template>
        </Plural>
      </template>
    </Branch>
    <div class="wrapper">
      <Branch branch="outer" option2="simple option">
        <template #option1>
          <Fragment>
            <span>Before plural</span>
            <Plural :n="count">
              <template #singular>
                <div>
                  Single item:
                  <Num :value="count" />
                  costing {{ ' ' }}
                  <Currency :value="price" currency="USD" />
                  at
                  <DateTime :value="timestamp" />
                  in {{ ' ' }}
                  <Branch branch="location" work="office">
                    <template #home>
                      <Fragment>
                        home folder with
                        <Var>variable</Var>
                      </Fragment>
                    </template>
                  </Branch>
                </div>
              </template>
              <template #plural>
                <div>
                  Multiple items:
                  <Num :value="count" />
                  costing {{ ' ' }}
                  <Currency :value="price * count" currency="USD" />
                  <Fragment>with fragments</Fragment>
                  and
                  <span>elements</span>
                </div>
              </template>
            </Plural>
            <span>After plural</span>
          </Fragment>
        </template>
      </Branch>
    </div>
    <Branch
      branch="unicode"
      latin="àáâãäåæçèéêëìíîï"
      cyrillic="абвгдежзийклмнопрстуфхцчшщъыьэюя"
      greek="αβγδεζηθικλμνξοπρστυφχψω"
      arabic="ابتثجحخدذرزسشصضطظعغفقكلمنهوي"
      hebrew="אבגדהוזחטיכלמנסעפצקרשת"
      chinese="你好世界中文测试"
      japanese="こんにちは世界ひらがなカタカナ漢字"
      korean="안녕하세요세계한글테스트"
      emoji="🌍🌎🌏🚀⚡️🎉💯✨🔥💎🌟⭐️🎯"
    />
    <Plural
      :n="1"
      singular="English left-to-right"
      plural="العربية من اليمين إلى اليسار"
      other="עברית מימין לשמאל"
    />
    <Branch branch="consistency">
      <template #path_a>
        <div>
          <Var>var1</Var>
          <Num :value="42" />
          <Currency :value="9.99" currency="USD" />
        </div>
      </template>
      <template #path_b>
        <Fragment>
          <Var>var1</Var>
          <Num :value="42" />
          <Currency :value="9.99" currency="USD" />
        </Fragment>
      </template>
    </Branch>
  </T>
</template>
