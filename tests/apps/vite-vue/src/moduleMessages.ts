import { t } from 'gt-vue';

if (!window.__gtVueSPAInitialized) {
  throw new Error('The application graph ran before initializeGTSPA()');
}

const evaluationKey = 'gt-vue-spa-module-evaluations';
export const moduleEvaluationCount =
  Number(sessionStorage.getItem(evaluationKey) ?? 0) + 1;
sessionStorage.setItem(evaluationKey, String(moduleEvaluationCount));

export const moduleGreeting = t(
  'Module translation loaded after SPA initialization.',
  { $context: 'Vite Vue bootstrap' }
);
