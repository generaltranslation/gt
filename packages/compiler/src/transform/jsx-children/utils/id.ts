export class IdObject {
  id: number;
  constructor(id: number = 0) {
    this.id = id;
  }
  increment() {
    this.id += 1;
  }
  get() {
    return this.id;
  }
  copy() {
    return new IdObject(this.id);
  }
}
