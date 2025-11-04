import { WorkflowStep } from './WorkflowStep.js';

export class Workflow<TInput, TOutput> {
  constructor(private steps: WorkflowStep<any, any>[]) {}

  async run(initialInput: TInput): Promise<TOutput> {
    let currentData: any = initialInput;

    for (const step of this.steps) {
      currentData = await step.run(currentData);
      await step.wait();
    }

    return currentData as TOutput;
  }
}
