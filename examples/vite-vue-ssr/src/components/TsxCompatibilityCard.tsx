import { defineComponent } from 'vue';
import { GT, T, Vue, translateTsxStatus } from '../i18n';

/** Demonstrates the gt-vue forms used by Vue JSX and TSX applications. */
export const TsxCompatibilityCard = defineComponent({
  name: 'TsxCompatibilityCard',
  setup() {
    const gt = GT.useGT();

    return () => (
      <article data-testid='tsx-compatibility-card'>
        <T context='TSX local reexport'>
          <Vue.Fragment>
            <h2>Local re-exports work in TSX</h2>
          </Vue.Fragment>
        </T>
        <GT.T context='TSX namespace component'>
          <p>Namespace components work in TSX.</p>
        </GT.T>
        <p data-testid='tsx-forwarded-string'>{translateTsxStatus(gt)}</p>
      </article>
    );
  },
});
