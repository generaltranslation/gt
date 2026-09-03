export type LocaleReport = {
  error?: string;
  failed: { error: string; field: string }[];
  partial: { field: string; missingTextNodes: number }[];
  translated: string[];
};

export type OutcomeSummary = {
  clean: string[];
  trouble: { detail: string; locale: string }[];
};

export const summarizeLocales = (
  locales: Record<string, LocaleReport>
): OutcomeSummary => {
  const summary: OutcomeSummary = { clean: [], trouble: [] };
  for (const [locale, report] of Object.entries(locales)) {
    const problems = [
      ...(report.error ? [report.error] : []),
      ...report.failed.map((item) => `${item.field}: ${item.error}`),
      ...report.partial.map(
        (item) =>
          `${item.field}: ${item.missingTextNodes} text nodes untranslated`
      ),
    ];
    if (report.translated.length === 0 && problems.length === 0) {
      problems.push('nothing translated');
    }
    if (problems.length === 0) summary.clean.push(locale);
    else summary.trouble.push({ detail: problems.join('; '), locale });
  }
  return summary;
};
