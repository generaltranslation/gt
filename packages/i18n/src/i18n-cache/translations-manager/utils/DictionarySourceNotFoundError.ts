export class DictionarySourceNotFoundError extends Error {
  constructor(id: string) {
    super(`I18nManager: source dictionary entry ${id} is not defined`);
    this.name = 'DictionarySourceNotFoundError';
  }
}
