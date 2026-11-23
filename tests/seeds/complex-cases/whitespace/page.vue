<script setup lang="ts">
import { Select, Currency, Num, Plural, T, Var } from 'gt-vue';
import { Fragment } from 'vue';

const amount = 100;
const count = 1;
</script>

<template>
  <T>
    Normal text
    <div>and some nesting</div>
    <div>content before</div>
    trailing text Text with multiple spaces
    <Fragment>
      {{ '        ' }}Text
      <div>yo yo</div>
      with
      <span />
      multiple spaces
    </Fragment>
    Hello World with spaces
    <Plural :n="1" _1="" _2="Files" />
    <Plural :n="1" _1="   File   " _2="   Files   " />
    <Select value="1" option1="" option2="   Padded   ">
      <template #option3><span>JSX content</span></template>
    </Select>
    Start
    <strong>Bold</strong>
    <em>Italic</em>
    End
    <div>Before</div>
    {{ '   ' }}
    <div>After</div>
    User:
    <Var>userName</Var>
    has
    <Num value="count" />
    items Click
    <a href="#">here</a>
    to continue. Line 1 Line 2 with tabs Line 3 with spaces You have
    <Plural :n="5" _1="  1 item  " _2="  2 items  " />
    Total:
    <Currency :value="amount" currency="USD" />
    available Status:
    <Plural :n="1" :_1="true" :_2="false" />
    -
    <Plural :n="0" :_1="null" _2="Active" />
    <div>Content</div>
    {{ '   ' }}
    <div>More content</div>
    Boundary whitespace test Hello
    <Var>name</Var>
    , you have
    <Num value="5" />
    new messages.
    <Plural :n="count" _1="1 file" _2="2 files" />
    <div>
      Welcome
      <strong>user</strong>
      ,
      <br />
      You have
      <span>messages</span>
      waiting.
    </div>
    Text with multiple spaces Text with multiple spaces
    <Select
      value="mixed"
      short="Brief"
      long="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    >
      <template #mixed>
        <Fragment>
          Very long text with
          <Var>embedded variables</Var>
          that continues for a very long time and includes multiple
          <Num :value="9999999" />
          {{ ' ' }}numeric values and{{ ' ' }}
          <Currency :value="1234567.89" currency="USD" />
          monetary amounts spread throughout the content to test how the algorithm handles very
          large content blocks with mixed variable types.
        </Fragment>
      </template>
    </Select>
    Hello World with spaces{{ true }}{{ true }}
    <div />
    <div />
    {{ true }}
    <Plural :n="1" :_1="true">
      <template #_3>
        <Fragment>{{ false }}{{ true }}</Fragment>
      </template>
    </Plural>
    <Plural :n="1" :_1="true">
      <template #_3>
        <Fragment>{{ true }}</Fragment>
      </template>
    </Plural>
     yo   yo  yo yo
    <div>{{ true }}</div>
    <div>
      <div />
      <div />
    </div>
    Hello
    <div>there</div>
    <div>there</div>
    <Plural :n="count">
      <template #_1>
        <Fragment>
          Text
          <Fragment />
          More text
        </Fragment>
      </template>
      <template #_2>
        <Fragment>
          <Fragment>Fragment</Fragment>
          content
        </Fragment>
      </template>
      <template #default>
        <Fragment><Fragment /></Fragment>
      </template>
    </Plural>
    <Fragment>{{ true }}</Fragment>
    <Fragment>{{ false }}</Fragment>
    <Fragment>{{ true }}{{ true }}</Fragment>
    <span>{{ true }}</span>
    <span>{{ false }}</span>
    <span>{{ true }}{{ true }}</span>
    <Select value="false" :a="false" :b="true" :c="null" :d="undefined">
      <template #e>
        <Fragment>{{ false }}</Fragment>
      </template>
      <template #f>
        <Fragment>{{ true }}</Fragment>
      </template>
      <template #g>
        <Fragment>{{ null }}</Fragment>
      </template>
      <template #h>
        <Fragment>{{ undefined }}</Fragment>
      </template>
      <template #i>
        <Fragment>{{ false }}{{ true }}</Fragment>
      </template>
      <template #j>
        <Fragment>{{ null }}{{ true }}</Fragment>
      </template>
      <template #k>
        <Fragment>{{ undefined }}{{ true }}</Fragment>
      </template>
    </Select>
    <Select value="bool">
      <template #true_val>
        <Fragment>{{ true }}</Fragment>
      </template>
      <template #false_val>
        <Fragment>{{ false }}</Fragment>
      </template>
      <template #mixed_true>
        <Fragment>Before {{ true }} after</Fragment>
      </template>
      <template #mixed_false>
        <Fragment>Before {{ false }} after</Fragment>
      </template>
      <template #multiple>
        <Fragment>
          {{ true }}{{ false }}{{ true }}
          <div />
        </Fragment>
      </template>
    </Select>
     yo   yo 
    <Select value="nested">
      <template #option1>
        <Fragment>
          <Fragment>
            <Fragment>
              <Fragment>
                <Fragment>Text</Fragment>
                <Fragment />
                <Fragment>More</Fragment>
              </Fragment>
            </Fragment>
            <span>Element</span>
          </Fragment>
          <Fragment>Final</Fragment>
        </Fragment>
      </template>
      <template #option2>
        <Fragment>
          <Fragment>
            <Fragment>
              <Fragment><Fragment>Flat</Fragment></Fragment>
               
            </Fragment>
          </Fragment>
        </Fragment>
      </template>
    </Select>
  </T>
</template>
