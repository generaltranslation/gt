<script setup lang="ts">
import { Fragment } from 'vue';
import { Branch, Currency, DateTime, Plural, T, Var } from 'gt-vue';

const variable = 'test';
const createdAt = new Date();
const multilineFile = `
            Multiline
            File
          `;
</script>

<template><T><Plural :n="1" _1="File" _2="Files" /><Branch branch="file" file="file.svg" directory="public" /><Plural :n="1" _1="File" :_2="42" /><Plural :n="1" :_1="true" :_2="false" /><Plural :n="1" :_1="null" _2="Files" /><Plural :n="1" :_1="`File`" :_2="`Files`" /><Plural :n="1" _1="File" :_2="42" /><Plural :n="1"><template #_1><Fragment>Single file</Fragment></template><template #_2><Fragment>Multiple files</Fragment></template></Plural><Plural :n="1"><template #_1><span>Single file</span></template><template #_2><span>Multiple files</span></template></Plural><Plural :n="1"><template #_1><Var>{{ variable }}</Var></template><template #_2><Fragment>Multiple <Var>{{ variable }}</Var>s</Fragment></template></Plural><div><Fragment>Yo</Fragment><Var>test</Var></div><Plural :n="1"><template #_1><Var>{{ variable }}</Var></template><template #_2><div><Fragment>Multiple <Var>{{ variable }}</Var>s</Fragment></div></template></Plural><Plural :n="1" _2="Multiple top-level items"><template #_1><Branch branch="type"><template #file><Plural :n="1" _2="Multiple nested files"><template #_1><Fragment>Single nested file</Fragment></template></Plural></template><template #directory><Fragment>Public directory</Fragment></template></Branch></template></Plural><Plural :n="1" _1="" _2="Files" /><Plural :n="1" _1="File" _2="" /><Plural :n="1" _1="   File   " _2="   Files   " /><Plural :n="1" :_1="multilineFile" _2="Files" /><Plural :n="1" _1="File with emoji 📁" _2="Files with emoji 📁📂" /><Branch branch="file" file="special-chars!@#$%^&amp;*().svg" directory="unicode-path-ñáéíóú" /><div>hello</div><Branch branch="level1" option2="Level 1 option 2"><template #option1><Branch branch="level2" option2="Level 2 option 2"><template #option1><Plural :n="1"><template #_1><Branch branch="level3"><template #option1><Fragment>Deep option 1</Fragment></template><template #option2><Var>{{ variable }}</Var></template></Branch></template><template #_2><Branch branch="level3"><template #option1><Currency :value="100" currency="USD" /></template><template #option2><DateTime :value="createdAt" /></template></Branch></template></Plural></template></Branch></template></Branch></T></template>
