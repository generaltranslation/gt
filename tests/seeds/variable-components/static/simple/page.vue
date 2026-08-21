<script setup lang="ts">
import { ref } from 'vue';
import { Branch, T, Var } from 'gt-vue';

const subjectChoice = ref('archie');
const subject = ref('Brian');
const predicateChoice = ref('is');
const predicate = ref('wants to be');
const objectChoice = ref('person');
const personStyle = ref('person');
</script>

<template><T><Branch :branch="subjectChoice"><template #archie>Archie</template><template #ernest>Ernest</template><template #fernanda>Fernanda</template><template #lily>Lily</template><template #brian>The beautiful <Var>{{ subject }}</Var></template></Branch> <Branch :branch="predicateChoice"><template #is>is</template><template #wouldHaveBeen>would have been</template><template #was>was</template><template #other><Var>{{ predicate }}</Var></template></Branch> <Branch :branch="objectChoice"><template #painter>a painter</template><template #famousPerson>a famous person</template><template #sculptor>a sculptor</template><template #person>a <Branch :branch="personStyle" person="person" coolPerson="cool person" /></template><template #coolPerson>a <Branch :branch="personStyle" person="person" coolPerson="cool person" /></template></Branch></T></template>
