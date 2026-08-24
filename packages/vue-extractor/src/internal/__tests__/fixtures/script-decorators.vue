<script setup lang="ts">
import { msg } from 'gt-vue';

function sealed(_value: Function) {}
@sealed
class Decorated {}

msg('Decorated script');
</script>
