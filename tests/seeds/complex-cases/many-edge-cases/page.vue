<script setup lang="ts">
import { Fragment } from 'vue';
import { Select, Currency, DateTime, Num, Plural, T, Var } from 'gt-vue';

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
      <template #_1><Fragment>{{ ' ' }}</Fragment></template>
      <template #_2><Fragment>{{ ' ' }}</Fragment></template>
    </Plural>
    <Plural :n="1">
      <template #_1><Fragment>{{ '\\t' }}</Fragment></template>
      <template #_2><Fragment>{{ '\\n' }}</Fragment></template>
    </Plural>
    <span>start</span> <span>middle</span> <span>end</span>
    <div>surrounded by spaces</div>
    <Fragment> leading spaces</Fragment>
    <Fragment>trailing spaces </Fragment>
    <Fragment> both sides </Fragment>
    <Plural :n="1" _2="files">
      <template #_1>
        <Fragment><Fragment><Fragment><Fragment>deep fragment nesting</Fragment></Fragment></Fragment></Fragment>
      </template>
    </Plural>
    <Select value="mixed" option2="simple">
      <template #option1>
        <Fragment>text<span>element</span>{{ 42 }}{{ true }}{{ null }}more text</Fragment>
      </template>
    </Select>
    <Fragment>start</Fragment><div>middle</div><Fragment>end</Fragment>
    <Plural
      :n="1"
      :zero="0.0"
      :one="-0"
      :two="999999999999"
      :few="-999999999999"
      :many="0.000000001">{{ -0.000000001 }}</Plural>
    <Select
      value="floats"
      :tiny="0.1"
      :precise="3.141592653589793"
      :scientific="1.23e-10"
      :big_scientific="1.23e10"
    />
    <Select value="hex" :small="0x1" :medium="0xabc" :large="0xdeadbeef" :mixed="0x123abc" />
    <Select value="mixed" option2="simple">
      <template #option1>
        <Fragment>text<span>element</span>{{ 42 }}{{ -1 }}{{ 3.14159 }}{{ 1e6 }}{{ 0xff }}{{ 0xabc }}{{ 0xdeadbeef }}{{ 0xff }}{{ 0xabc }}{{ NaN }}{{ true }}{{ false }}{{ undefined }}{{ Infinity }}{{ null }}<Fragment /><Fragment>{{ ' ' }}</Fragment>{{ +5 }}more text</Fragment>
      </template>
      <template #option3><Fragment>Hello <span>world</span>!</Fragment></template>
    </Select>
    <Plural
      :n="1"
      _1="Quotes: &quot; and '"
      _2="Backslashes: \\ and \\n and \\t">{{ 'Unicode: \\u0041 and \\x41' }}</Plural>
    <Select
      value="raw"
      json='{"key": "value", "array": [1,2,3]}'
      regex="/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/"
      path="C:\Program Files\App\file.exe"
    />
    <Select
      value="complex"
      url="https://example.com:8080/path?param=value&amp;other=123#section"
      email="user.name+tag@subdomain.example-site.co.uk"
      css="body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }"
    />
    <Plural :n="1" :zero="false" :one="true" :two="null" few="" :many="0">false</Plural>
    <Select
      value="booleans"
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
      _1="Template with ${escaped} and `backticks`"
      :_2="multilineTemplate">Mixed "quotes" and 'apostrophes' in template</Plural>
    <Select
      value="templates"
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
      _1="sing"
      _2="plur">other</Plural>
    <Select value="many_options" a="option a" b="option b" c="option c" d="option d" e="option e" :h="42" :i="true" :j="null">
      <template #f><Fragment>fragment f</Fragment></template>
      <template #g><span>element g</span></template>
    </Select>
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
    <Select value="l1" option2="l1 end">
      <template #option1>
        <Plural :n="1" _2="l1 plural">
          <template #_1>
            <Select value="l2" option2="l2 end">
              <template #option1>
                <Plural :n="1" _2="l2 plural">
                  <template #_1>
                    <Select value="l3" option2="l3 end">
                      <template #option1>
                        <Plural :n="1" _2="l3 plural">
                          <template #_1>
                            <Select value="l4" option2="l4 end">
                              <template #option1>
                                <Plural :n="1" _2="l4 plural">
                                  <template #_1>
                                    <Select value="l5" option2="l5 end">
                                      <template #option1>
                                        <Plural :n="1" _2="l5 plural">
                                          <template #_1>
                                            <Select value="l6" option2="l6 end">
                                              <template #option1><Var>maximum depth</Var></template>
                                            </Select>
                                          </template>
                                        </Plural>
                                      </template>
                                    </Select>
                                  </template>
                                </Plural>
                              </template>
                            </Select>
                          </template>
                        </Plural>
                      </template>
                    </Select>
                  </template>
                </Plural>
              </template>
            </Select>
          </template>
        </Plural>
      </template>
    </Select>
    <div class="wrapper">
      <Select value="outer" option2="simple option">
        <template #option1>
          <Fragment>
            <span>Before plural</span>
            <Plural :n="count">
              <template #_1>
                <div>Single item: <Num :value="count" />costing{{ ' ' }}<Currency :value="price" currency="USD" />at <DateTime :value="timestamp" />in{{ ' ' }}<Select value="location" work="office"><template #home><Fragment>home folder with <Var>variable</Var></Fragment></template></Select></div>
              </template>
              <template #_2>
                <div>Multiple items: <Num :value="count" />costing{{ ' ' }}<Currency :value="price * count" currency="USD" /><Fragment>with fragments</Fragment> and <span>elements</span></div>
              </template>
            </Plural>
            <span>After plural</span>
          </Fragment>
        </template>
      </Select>
    </div>{{ '' }}<Var />
    <Select value="test" invalid="ignored" also_invalid="also ignored" />
    <Select
      value="unicode"
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
      _1="English left-to-right"
      _2="العربية من اليمين إلى اليسار">עברית מימין לשמאל</Plural>Normal text <div>and some nesting</div> with trailing space<Plural :n="1">
      <template #_1><Fragment>{{ ' ' }}</Fragment></template>
      <template #_2><Fragment /></template>
    </Plural>
    <Plural :n="1" :zero="0" :one="1" :two="-1" :few="3.14159" :many="1e6">{{ 0xff }}</Plural>
    <Select value="test" empty="" whitespace="   padded   " :number="42" :boolean="true" :null_value="null">
      <template #fragment><Fragment>fragment content</Fragment></template>
      <template #element><span>element content</span></template>
    </Select>
    <span>word1</span> <span>word2</span> <span>word3</span>
    <Fragment>Fragment start</Fragment> middle text <Fragment>Fragment end</Fragment>
    <Select value="consistency">
      <template #path_a><div><Var>var1</Var><Num value="42" /><Currency value="9.99" currency="USD" /></div></template>
      <template #path_b><Fragment><Var>var1</Var><Num value="42" /><Currency value="9.99" currency="USD" /></Fragment></template>
    </Select>
  </T>
</template>
