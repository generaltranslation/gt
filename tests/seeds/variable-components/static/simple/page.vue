<script setup lang="ts">
import { ref } from 'vue';
import { Select, T, Var } from 'gt-vue';

const subjectChoice = ref('archie');
const subject = ref('Brian');
const predicateChoice = ref('is');
const predicate = ref('wants to be');
const objectChoice = ref('person');
const personStyle = ref('person');
</script>

<template><T><Select :value="subjectChoice"><template #archie>Archie</template><template #ernest>Ernest</template><template #fernanda>Fernanda</template><template #lily>Lily</template><template #brian>The beautiful <Var>{{ subject }}</Var></template></Select> <Select :value="predicateChoice"><template #is>is</template><template #wouldHaveBeen>would have been</template><template #was>was</template><template #default><Var>{{ predicate }}</Var></template></Select> <Select :value="objectChoice"><template #painter>a painter</template><template #famousPerson>a famous person</template><template #sculptor>a sculptor</template><template #person>a <Select :value="personStyle" person="person" coolPerson="cool person" /></template><template #coolPerson>a <Select :value="personStyle" person="person" coolPerson="cool person" /></template></Select></T></template>
