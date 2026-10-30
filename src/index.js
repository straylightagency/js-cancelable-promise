/**
 * Make a Promise cancelable by calling cancel().
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
            const onAbort = () => {
                this.isPending = false;
                reject(signal.reason);
            };

            signal.addEventListener('abort', onAbort, { once: true });

            const cleanup = () => {
                signal.removeEventListener('abort', onAbort);
            };

            const onResolve = value => {
                if (signal.aborted) {
                    return;
                }

                this.isPending = false;
                cleanup();
                resolve(value);
            };

            const onReject = reason => {
                if (signal.aborted) {
                    return;
                }

                this.isPending = false;
                cleanup();
                reject(reason);
            };

            try {
                executor(onResolve, onReject, signal);
            } catch (error) {
                onReject(error);
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
     * Register fulfillment and rejection handlers.
     *
     * @param {Function} onFulfilled
     * @param {Function} onRejected
     * @returns {CancelablePromise}
     */
    then(onFulfilled, onRejected) {
        return CancelablePromise.from(
            this.promise.then(onFulfilled, onRejected),
            this.#controller
        );
    }

    /**
     * Register a rejection handler.
     *
     * @param {Function} onRejected
     * @returns {CancelablePromise}
     */
    catch(onRejected) {
        return CancelablePromise.from(
            this.promise.catch(onRejected),
            this.#controller
        );
    }

    /**
     * Register a callback executed when the promise settles.
     *
     * @param {Function} onFinally
     * @returns {CancelablePromise}
     */
    finally(onFinally) {
        return CancelablePromise.from(
            this.promise.finally(onFinally),
            this.#controller
        );
    }

    /**
     * Cancel the pending operation.
     *
     * @param {*} reason
     * @returns {void}
     */
    cancel(reason) {
        if (!this.isPending || this.isCanceled) {
            return;
        }

        const error = reason instanceof Error
            ? reason
            : new DOMException(
                reason ?? 'Operation canceled',
                'AbortError'
            );

        this.#controller.abort(error);
    }

    /**
     * Convert a Promise into a CancelablePromise.
     *
     * The supplied Promise is raced against the AbortSignal.
     * Cancellation rejects the wrapper even if the original
     * Promise does not support cancellation.
     *
     * @param {Promise} promise
     * @param {AbortController} controller
     * @returns {CancelablePromise}
     */
    static from(promise, controller = new AbortController()) {
        const instance = Object.create(CancelablePromise.prototype);

        instance.#controller = controller;
        instance.isPending = true;

        const { signal } = controller;

        instance.promise = new Promise((resolve, reject) => {
            let settled = false;

            const cleanup = () => {
                signal.removeEventListener('abort', onAbort);
            };

            const settle = (callback, value) => {
                if (settled) {
                    return;
                }

                settled = true;
                instance.isPending = false;

                cleanup();
                callback(value);
            };

            const onAbort = () => {
                settle(
                    reject,
                    signal.reason ?? new DOMException(
                        'Operation canceled',
                        'AbortError'
                    )
                );
            };

            if (signal.aborted) {
                onAbort();
            } else {
                signal.addEventListener('abort', onAbort, {
                    once: true,
                });
            }

            Promise.resolve(promise).then(
                value => settle(resolve, value),
                reason => settle(reject, reason)
            );
        });

        return instance;
    }
}

/**
 * Convert a Promise into a CancelablePromise.
 *
 * @param {Promise} promise
 * @param {AbortController} controller
 * @returns {CancelablePromise}
 */
export function makeCancelable(
    promise,
    controller = new AbortController()
) {
    return CancelablePromise.from(promise, controller);
}