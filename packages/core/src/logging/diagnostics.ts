export type DiagnosticSeverity = 'Error' | 'Warning';

/**
 * Text slots follow the five-part error message model:
 * what happened, reassurance, why it happened, how to fix it, and a way out.
 */
export type DiagnosticMessageInput = {
  source?: string;
  severity?: DiagnosticSeverity;
  whatHappened: string;
  reassurance?: string;
  why?: string;
  fix?: string;
  wayOut?: string;
  details?: string | string[];
  docsUrl?: string;
};

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?)]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function stripSentence(text: string): string {
  const trimmed = text.trim();
  let end = trimmed.length;
  while (end > 0) {
    const char = trimmed[end - 1];
    if (char !== '.' && char !== '!' && char !== '?') break;
    end -= 1;
  }
  return trimmed.slice(0, end);
}

function lowercaseFirstWord(text: string): string {
  return text.replace(/^[A-Z][a-z]/, (match) => match.toLowerCase());
}

function formatDetails(details: string | string[] | undefined): string {
  if (!details) return '';
  const detailText = Array.isArray(details) ? details.join(', ') : details;
  return ensureSentence(`Details: ${detailText}`);
}

export function createDiagnosticMessage({
  source,
  severity,
  whatHappened,
  reassurance,
  why,
  fix,
  wayOut,
  details,
  docsUrl,
}: DiagnosticMessageInput): string {
  const prefix = source
    ? severity
      ? `${source} ${severity}:`
      : `${source}:`
    : severity
      ? `${severity}:`
      : '';
  const whatAndWhy = why
    ? `${stripSentence(whatHappened)} because ${lowercaseFirstWord(stripSentence(why))}`
    : whatHappened;
  const shouldCombineWayOut =
    !!fix && !!wayOut && /^[a-z]/.test(stripSentence(wayOut));
  const fixAndWayOut = shouldCombineWayOut
    ? `${stripSentence(fix)}, or ${lowercaseFirstWord(stripSentence(wayOut))}`
    : fix;
  const messageParts = [
    whatAndWhy,
    reassurance,
    fixAndWayOut,
    shouldCombineWayOut ? undefined : wayOut,
    formatDetails(details),
  ]
    .filter((part): part is string => !!part)
    .map(ensureSentence);

  if (docsUrl) {
    messageParts.push(`Learn more: ${docsUrl}`);
  }

  const message = messageParts.join(' ');
  return prefix ? `${prefix} ${message}` : message;
}
