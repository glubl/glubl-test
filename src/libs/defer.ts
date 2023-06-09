export class DeferredPromise<T> {
    _promise: Promise<T>
    resolve!: (value: T) => void
    reject!: (reason?: any) => void
    then: typeof this._promise.then
    catch: typeof this._promise.catch
    finally: typeof this._promise.finally
    constructor() {
      this._promise = new Promise<T>((resolve, reject) => {
        // assign the resolve and reject functions to `this`
        // making them usable on the class instance
        this.resolve = resolve;
        this.reject = reject;
      });
      // bind `then` and `catch` to implement the same interface as Promise
      this.then = this._promise.then.bind(this._promise);
      this.catch = this._promise.catch.bind(this._promise);
      this.finally = this._promise.finally.bind(this._promise);
      this[Symbol.toStringTag] = 'Promise';
    }
}