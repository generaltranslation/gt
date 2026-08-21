<script setup lang="ts">
import { Fragment } from 'vue';
import { Branch, Currency, DateTime, Num, Plural, T, Var } from 'gt-vue';

const count = 42;
const price = 9.99;
const timestamp = new Date();
const multilineTemplate = `Multi
            line
            template
            literal`;
const markdown = `# Title\n\n**Bold** and *italic* text.\n\n\`\`\`js\nconst x = 42;\n\`\`\``;
</script>

<template>
  <T>
    <Plural :n="1">
      <template #singular><Fragment>{{ ' ' }}</Fragment></template>
      <template #plural><Fragment>{{ ' ' }}</Fragment></template>
    </Plural>
    <Plural :n="1">
      <template #singular><Fragment>{{ '\\t' }}</Fragment></template>
      <template #plural><Fragment>{{ '\\n' }}</Fragment></template>
    </Plural>
    <span>start</span> <span>middle</span> <span>end</span>
    <div>surrounded by spaces</div>
    <Fragment> leading spaces</Fragment>
    <Fragment>trailing spaces </Fragment>
    <Fragment> both sides </Fragment>
    <Plural :n="1" plural="files">
      <template #singular>
        <Fragment><Fragment><Fragment><Fragment>deep fragment nesting</Fragment></Fragment></Fragment></Fragment>
      </template>
    </Plural>
    <Branch branch="mixed" option2="simple">
      <template #option1>
        <Fragment>text<span>element</span>{{ 42 }}{{ true }}{{ null }}more text</Fragment>
      </template>
    </Branch>
    <Fragment>start</Fragment><div>middle</div><Fragment>end</Fragment>
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
      :big_scientific="1.23e10"
    />
    <Branch branch="hex" :small="0x1" :medium="0xabc" :large="0xdeadbeef" :mixed="0x123abc" />
    <Branch branch="mixed" option2="simple">
      <template #option1>
        <Fragment>text<span>element</span>{{ 42 }}{{ -1 }}{{ 3.14159 }}{{ 1e6 }}{{ 0xff }}{{ 0xabc }}{{ 0xdeadbeef }}{{ 0xff }}{{ 0xabc }}{{ NaN }}{{ true }}{{ false }}{{ undefined }}{{ Infinity }}{{ null }}<Fragment /><Fragment>{{ ' ' }}</Fragment>{{ +5 }}more text</Fragment>
      </template>
      <template #option3><Fragment>Hello <span>world</span>!</Fragment></template>
    </Branch>
    <Plural
      :n="1"
      singular="Quotes: &quot; and '"
      plural="Backslashes: \\ and \\n and \\t"
      other="Unicode: \u0041 and \x41"
    />
    <Branch
      branch="raw"
      json='{"key": "value", "array": [1,2,3]}'
      regex="/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/"
      path="C:\Program Files\App\file.exe"
    />
    <Branch
      branch="complex"
      url="https://example.com:8080/path?param=value&amp;other=123#section"
      email="user.name+tag@subdomain.example-site.co.uk"
      css="body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }"
    />
    <Plural :n="1" :zero="false" :one="true" :two="null" few="" :many="0" other="false" />
    <Branch
      branch="booleans"
      :truthy="true"
      :falsy="false"
      :nullish="null"
      empty=""
      :zero="0"
      string_true="true"
      string_false="false"
    />
    <Plural
      :n="1"
      singular="Template with ${escaped} and `backticks`"
      :plural="multilineTemplate"
      other="Mixed &quot;quotes&quot; and 'apostrophes' in template"
    />
    <Branch
      branch="templates"
      code="function test() { return `Hello ${name}`; }"
      :markdown="markdown"
      xml="&lt;root&gt;&lt;child attr=&quot;value&quot;&gt;content&lt;/child&gt;&lt;/root&gt;"
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
    <Branch branch="many_options" a="option a" b="option b" c="option c" d="option d" e="option e" :h="42" :i="true" :j="null">
      <template #f><Fragment>fragment f</Fragment></template>
      <template #g><span>element g</span></template>
    </Branch>
    <Var>content</Var><Var>content</Var><Var>content</Var><Var>content</Var><Var>content</Var><Var>content</Var><Var>content</Var>
    <Num value="42" /><Num :value="-42" /><Num value="3.14159" /><Num :value="0" /><Num :value="0xff" />
    <Currency :value="price" currency="USD" />
    <Currency value="1234.56" currency="EUR" />
    <Currency value="1000" currency="JPY" />
    <Currency value="0.00123456" currency="BTC" />
    <DateTime :value="timestamp" />
    <DateTime :value="new Date(0)" />
    <DateTime :value="new Date(0)" />
    <DateTime :value="new Date(0)" />
    <Branch branch="l1" option2="l1 end">
      <template #option1>
        <Plural :n="1" plural="l1 plural">
          <template #singular>
            <Branch branch="l2" option2="l2 end">
              <template #option1>
                <Plural :n="1" plural="l2 plural">
                  <template #singular>
                    <Branch branch="l3" option2="l3 end">
                      <template #option1>
                        <Plural :n="1" plural="l3 plural">
                          <template #singular>
                            <Branch branch="l4" option2="l4 end">
                              <template #option1>
                                <Plural :n="1" plural="l4 plural">
                                  <template #singular>
                                    <Branch branch="l5" option2="l5 end">
                                      <template #option1>
                                        <Plural :n="1" plural="l5 plural">
                                          <template #singular>
                                            <Branch branch="l6" option2="l6 end">
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
                          </template>
                        </Plural>
                      </template>
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
                <div>Single item: <Num :value="count" />costing{{ ' ' }}<Currency :value="price" currency="USD" />at <DateTime :value="timestamp" />in{{ ' ' }}<Branch branch="location" work="office"><template #home><Fragment>home folder with <Var>variable</Var></Fragment></template></Branch></div>
              </template>
              <template #plural>
                <div>Multiple items: <Num :value="count" />costing{{ ' ' }}<Currency :value="price * count" currency="USD" /><Fragment>with fragments</Fragment> and <span>elements</span></div>
              </template>
            </Plural>
            <span>After plural</span>
          </Fragment>
        </template>
      </Branch>
    </div>{{ '' }}<Var />
    <Branch branch="test" invalid="ignored" also_invalid="also ignored" />
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
      symbols="©®™€£¥¢¤§¶†‡•…‰‱′″‴‵‶‷‸‹›«»¿¡"
      math="∀∂∃∅∇∈∉∋∌∏∑−∕∗∘∙√∝∞∟∠∡∢∣∤∥∦∧∨∩∪∫∬∭∮"
    />
    <Plural
      :n="1"
      singular="English left-to-right"
      plural="العربية من اليمين إلى اليسار"
      other="עברית מימין לשמאל"
    />Normal text <div>and some nesting</div> with trailing space<Plural :n="1">
      <template #singular><Fragment>{{ ' ' }}</Fragment></template>
      <template #plural><Fragment /></template>
    </Plural>
    <Plural :n="1" :zero="0" :one="1" :two="-1" :few="3.14159" :many="1e6" :other="0xff" />
    <Branch branch="test" empty="" whitespace="   padded   " :number="42" :boolean="true" :null_value="null">
      <template #fragment><Fragment>fragment content</Fragment></template>
      <template #element><span>element content</span></template>
    </Branch>
    <span>word1</span> <span>word2</span> <span>word3</span>
    <Fragment>Fragment start</Fragment> middle text <Fragment>Fragment end</Fragment>
    <Branch branch="consistency">
      <template #path_a><div><Var>var1</Var><Num value="42" /><Currency value="9.99" currency="USD" /></div></template>
      <template #path_b><Fragment><Var>var1</Var><Num value="42" /><Currency value="9.99" currency="USD" /></Fragment></template>
    </Branch>
  </T>
</template>
