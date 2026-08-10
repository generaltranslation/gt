<script setup lang="ts">
import { Fragment } from 'vue';
import { Branch, Currency, DateTime, Plural, T, Var } from 'gt-vue';

const variable = 'test';
const createdAt = new Date(0);
const multilineFile = `
            Multiline
            File
          `;
</script>

<template><T><Plural :n="1" one="File" other="Files" /><Branch branch="file" file="file.svg" directory="public" /><Plural :n="1" one="File" :other="42" /><Plural :n="1" :one="true" :other="false" /><Plural :n="1" :one="null" other="Files" /><Plural :n="1" :one="`File`" :other="`Files`" /><Plural :n="1" one="File" :other="42" /><Plural :n="1"><template #one><Fragment>Single file</Fragment></template><template #other><Fragment>Multiple files</Fragment></template></Plural><Plural :n="1"><template #one><span>Single file</span></template><template #other><span>Multiple files</span></template></Plural><Plural :n="1"><template #one><Var>{{ variable }}</Var></template><template #other><Fragment>Multiple <Var>{{ variable }}</Var>s</Fragment></template></Plural><div><Fragment>Yo</Fragment><Var>test</Var></div><Plural :n="1"><template #one><Var>{{ variable }}</Var></template><template #other><div><Fragment>Multiple <Var>{{ variable }}</Var>s</Fragment></div></template></Plural><Plural :n="1" other="Multiple top-level items"><template #one><Branch branch="type"><template #file><Plural :n="1" other="Multiple nested files"><template #one><Fragment>Single nested file</Fragment></template></Plural></template><template #directory><Fragment>Public directory</Fragment></template></Branch></template></Plural><Plural :n="1" one="" other="Files" /><Plural :n="1" one="File" other="" /><Plural :n="1" one="   File   " other="   Files   " /><Plural :n="1" :one="multilineFile" other="Files" /><Plural :n="1" one="File with emoji 📁" other="Files with emoji 📁📂" /><Branch branch="file" file="special-chars!@#$%^&amp;*().svg" directory="unicode-path-ñáéíóú" /><div>hello</div><Branch branch="level1" option2="Level 1 option 2"><template #option1><Branch branch="level2" option2="Level 2 option 2"><template #option1><Plural :n="1"><template #one><Branch branch="level3"><template #option1><Fragment>Deep option 1</Fragment></template><template #option2><Var>{{ variable }}</Var></template></Branch></template><template #other><Branch branch="level3"><template #option1><Currency :value="100" currency="USD" /></template><template #option2><DateTime :value="createdAt" /></template></Branch></template></Plural></template></Branch></template></Branch></T></template>
