export class ErrorTracker {
  private errors: string[] = [];

  addErrors(errors: string[]) {
    this.errors.push(...errors);
  }

  addError(error: string) {
    this.errors.push(error);
  }

  getErrors() {
    return this.errors;
  }
}
