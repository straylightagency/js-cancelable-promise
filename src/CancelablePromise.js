/**
 * @author anthony@straylightagency.be
 */
export default class CancelablePromise extends Promise {
    /**
     * @type {boolean}
     */
    isPending = true;

    /**
     * @type {boolean}
     */
    isCanceled = false;

    /**
     * @type {Function}
     */
    cancelHandler = reason => {};

    /**
     * @param executor {Function}
     */
    constructor(executor) {
        super( (resolve, reject) => {
            const onResolve = value => {
                this.isPending = true;
                resolve( value );
            };

            const onReject = reason => {
                this.isPending = false;
                reject( reason );
            };

            const onCancel = handler => {
                if ( !this.isPending ) {
                    throw "The `onCancel` handler was attached after the promise settled.";
                }

                this.cancelHandler = handler;
            }

            return executor( onResolve, onReject, onCancel );
        } );
    }

    /**
     * @param reason {String}
     */
    cancel(reason = undefined) {
        if ( !this.isPending || this.isCanceled ) {
            return;
        }

        const handler = this.cancelHandler;

        handler( reason );

        this.isCanceled = true;
    }
}
