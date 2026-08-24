import type { GT } from 'generaltranslation';
import { describe, expect, it } from 'vitest';
import { Libraries } from '../../../types/libraries.js';
import { TEMPLATE_FILE_NAME } from '../../../utils/constants.js';
import {
  PollTranslationJobsStep,
  type FileStatusTracker,
} from '../PollJobsStep.js';

type StatusFormatter = {
  generateStatusSuffixText(
    fileTracker: FileStatusTracker,
    fileQueryData: Array<{
      branchId: string;
      fileId: string;
      fileName: string;
      locale: string;
      versionId: string;
    }>
  ): string;
};

const templateFile = {
  branchId: 'branch-1',
  fileId: 'template-1',
  fileName: TEMPLATE_FILE_NAME,
  locale: 'fr',
  versionId: 'version-1',
};

function getStatusText(inlineLibrary?: 'gt-react' | 'gt-vue'): string {
  const step = new PollTranslationJobsStep(
    {} as GT,
    inlineLibrary
  ) as unknown as StatusFormatter;
  const tracker: FileStatusTracker = {
    completed: new Map([['template', templateFile]]),
    failed: new Map(),
    inProgress: new Map(),
    skipped: new Map(),
  };

  return step.generateStatusSuffixText(tracker, [templateFile]);
}

describe('PollTranslationJobsStep inline catalog labels', () => {
  it('labels Vue catalogs as Vue elements', () => {
    expect(getStatusText(Libraries.GT_VUE)).toContain('<Vue Elements>');
  });

  it('preserves the historical React catalog label', () => {
    expect(getStatusText(Libraries.GT_REACT)).toContain('<React Elements>');
    expect(getStatusText()).toContain('<React Elements>');
  });
});
