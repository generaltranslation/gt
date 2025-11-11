export abstract class WorkflowStep<TInput = void, TOutput = void> {
  abstract run(input: TInput): Promise<TOutput>;

  abstract wait(): Promise<void>;
}
