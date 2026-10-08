/**
 * Base Class
 * Make Promise cancelable by calling a method "cancel()" that abort the promise
 *
 * @author anthony@straylightagency.be
 */
export class CancelablePromise {
    /**
     * @type {Promise}
     */
    promise;

    /**
     * @type {AbortController}
     */
    #controller;

    /**
     * @type {boolean}
     */
    isPending = true;

    /**
     * @param {Function} executor (resolve, reject, signal) => void
     */
    constructor(executor) {
        this.#controller = new AbortController();
        const { signal } = this.#controller;

        this.promise = new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => {
                this.isPending = false;
                reject(signal.reason);
            }, { once: true });

            const onResolve = value => {
                if (signal.aborted) return;
                this.isPending = false;
                resolve(value);
            };

            const onReject = reason => {
                if (signal.aborted) return;
                this.isPending = false;
                reject(reason);
            };

            try {
                executor(onResolve, onReject, signal);
            } catch (err) {
                onReject(err);
            }
        });
    }

    /**
     * @returns {boolean}
     */
    get isCanceled() {
        return this.#controller.signal.aborted;
    }

    /**
     * @returns {AbortSignal}
     */
    get signal() {
        return this.#controller.signal;
    }

    /**
     * @param {function} onFulfilled
     * @param {function} onRejected
     * @returns {CancelablePromise|*}
     */
    then(onFulfilled, onRejected) {
        return CancelablePromise.from(this.promise.then(onFulfilled, onRejected), this.#controller);
    }

    /**
     * @param {function} onRejected
     * @returns {CancelablePromise|*}
     */
    catch(onRejected) {
        return CancelablePromise.from(this.promise.catch(onRejected), this.#controller);
    }

    /**
     * @param {function} onFinally
     * @returns {CancelablePromise|*}
     */
    finally(onFinally) {
        return CancelablePromise.from(this.promise.finally(onFinally), this.#controller);
    }

    /**
     * @param {*} reason
     */
    cancel(reason) {
        if (!this.isPending || this.isCanceled) {
            return;
        }

        const error = reason instanceof Error
            ? reason
            : new DOMException(reason || "Operation canceled", "AbortError");

        this.#controller.abort(error);
    }

    /**
     *
     * @param {Promise} promise
     * @param {AbortController} controller
     * @returns {CancelablePromise|*}
     */
    static from(promise, controller = new AbortController()) {
        const instance = Object.create(CancelablePromise.prototype);
        instance.promise = promise;
        instance.#controller = controller;
        instance.isPending = true;

        promise.finally(() => {
            instance.isPending = false;
        });

        return instance;
    }
}

/**
 * Convert a promise into a CancelablePromise.
 *
 * @param {Promise} promise
 * @param {AbortController} controller
 * @returns {CancelablePromise|*}
 */
export function makeCancelable(promise, controller = new AbortController()) {
    return CancelablePromise.from(promise, controller);
}