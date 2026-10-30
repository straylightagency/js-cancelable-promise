# @straylightagency/cancelable-promise

A lightweight JavaScript Promise class that supports cancellation through the native `AbortController` API.

It provides a familiar Promise interface with additional methods to cancel pending operations, track their state, and access an `AbortSignal` for cooperative cancellation.

## Features

- Native ES modules and no external dependencies.
- Promise-compatible `then()`, `catch()`, and `finally()` methods.
- Cancel pending operations with a single `cancel()` call.
- Access the underlying Promise through the `promise` property.
- Track the operation state with `isPending` and `isCanceled`.
- Native `AbortSignal` support for integrating cancellation into asynchronous operations.
- Convert existing promises into cancelable promises with `makeCancelable()` or `CancelablePromise.from()`.
- Share an `AbortController` across multiple promises and chained operations.

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Creating a cancelable promise](#creating-a-cancelable-promise)
- [Canceling an operation](#canceling-an-operation)
- [Tracking the operation state](#tracking-the-operation-state)
- [Using AbortSignal](#using-abortsignal)
- [Converting an existing promise](#converting-an-existing-promise)
- [Chaining promises](#chaining-promises)
- [API reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @straylightagency/cancelable-promise
```

## Quick start

Import `CancelablePromise` and create an asynchronous operation that can be canceled:

```js
import { CancelablePromise } from '@straylightagency/cancelable-promise';

const operation = new CancelablePromise((resolve, reject, signal) => {
    const timeoutId = setTimeout(() => {
        resolve('Operation completed');
    }, 5000);

    signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
    }, { once: true });
});

operation
    .then(result => {
        console.log(result);
    })
    .catch(error => {
        if (error.name === 'AbortError') {
            console.log('Operation canceled');
            return;
        }

        console.error(error);
    });

// Cancel the operation before it completes.
operation.cancel();
```

Calling `cancel()` aborts the associated signal and rejects the underlying Promise with an `AbortError` by default.

The executor receives an `AbortSignal` that can be used to stop the underlying operation. Cancellation is cooperative: the executor must listen to the signal or pass it to an API that supports cancellation.

## Creating a cancelable promise

The `CancelablePromise` constructor accepts an executor function, similar to the native `Promise` constructor.

The executor receives three arguments:

```js
new CancelablePromise((resolve, reject, signal) => {
    // Start an asynchronous operation.
});
```

| Argument | Description |
| --- | --- |
| `resolve(value)` | Resolves the promise with the specified value. |
| `reject(reason)` | Rejects the promise with the specified reason. |
| `signal` | An `AbortSignal` that indicates whether the operation has been canceled. |

The executor can use `resolve()` and `reject()` to settle the promise. Calls made after cancellation are ignored.

Synchronous errors thrown by the executor are caught and used to reject the promise.

### Example

```js
const operation = new CancelablePromise((resolve, reject) => {
    const success = true;

    if (success) {
        resolve('Success');
    } else {
        reject(new Error('Something went wrong'));
    }
});

operation.then(result => {
    console.log(result);
});
```

## Canceling an operation

Use `cancel()` to cancel a pending operation:

```js
const operation = new CancelablePromise((resolve, reject, signal) => {
    const timeoutId = setTimeout(() => {
        resolve('Done');
    }, 5000);

    signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
    }, { once: true });
});

operation.catch(error => {
    console.error(error);
});

operation.cancel();
```

The cancellation signal is triggered immediately when `cancel()` is called. The Promise rejection is then handled through the usual Promise mechanism.

### Custom cancellation reason

You can provide a custom cancellation message:

```js
operation.cancel('User canceled the operation');
```

A string reason is converted into a `DOMException` named `AbortError`.

You can also provide an existing error:

```js
operation.cancel(new Error('Operation interrupted'));
```

In this case, the supplied error becomes the rejection reason.

Calling `cancel()` on an operation that has already settled or has already been canceled has no effect.

### Canceling timers and other operations

For asynchronous operations that do not support `AbortSignal` natively, you can listen to the signal and perform the necessary cleanup yourself.

For example, to cancel a timer:

```js
const operation = new CancelablePromise((resolve, reject, signal) => {
    const timeoutId = setTimeout(() => {
        resolve('Done');
    }, 5000);

    signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
    }, { once: true });
});
```

This approach also works for event listeners, subscriptions, and other resources that require explicit cleanup.

## Tracking the operation state

A `CancelablePromise` exposes two properties to inspect its state.

| Property | Type | Description |
| --- | --- | --- |
| `isPending` | `boolean` | Indicates whether the wrapped promise is still pending. |
| `isCanceled` | `boolean` | Indicates whether the associated `AbortController` has been aborted. |

For example:

```js
const operation = new CancelablePromise(resolve => {
    setTimeout(() => {
        resolve('Done');
    }, 1000);
});

console.log(operation.isPending); // true
console.log(operation.isCanceled); // false

operation.cancel();

console.log(operation.isPending); // false
console.log(operation.isCanceled); // true
```

`isPending` describes the state of the promise associated with the instance. `isCanceled` reflects the state of its cancellation controller.

When multiple instances share the same controller, their cancellation states are linked, even though their promises may settle at different times.

## Using AbortSignal

Each instance exposes its `AbortSignal` through the `signal` getter.

This signal can be passed to APIs that support cancellation, including `fetch()`:

```js
import { CancelablePromise } from '@straylightagency/cancelable-promise';

const operation = new CancelablePromise((resolve, reject, signal) => {
    fetch('https://api.example.com/users', { signal })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.json();
        })
        .then(resolve)
        .catch(reject);
});

operation
    .then(users => {
        console.log(users);
    })
    .catch(error => {
        if (error.name === 'AbortError') {
            console.log('Request canceled');
            return;
        }

        console.error(error);
    });

// Abort the request.
operation.cancel();
```

When `cancel()` is called, the signal is aborted. The `fetch()` request responds to that signal and interrupts the ongoing request.

The executor remains responsible for handling errors from the underlying operation and passing them to `reject()`.

## Converting an existing promise

If you already have a Promise, you can wrap it in a `CancelablePromise` without rewriting the original operation.

Use the `makeCancelable()` helper:

```js
import { makeCancelable } from '@straylightagency/cancelable-promise';

const promise = new Promise(resolve => {
    setTimeout(() => resolve('Done'), 5000);
});

const operation = makeCancelable(promise);

operation
    .then(result => {
        console.log(result);
    })
    .catch(error => {
        console.error(error);
    });

operation.cancel();
```

You can also use the static `CancelablePromise.from()` method:

```js
import { CancelablePromise } from '@straylightagency/cancelable-promise';

const promise = fetch('https://api.example.com/users');

const operation = CancelablePromise.from(promise);
```

**Important:** wrapping an existing Promise does not automatically stop the underlying operation. Cancellation rejects the wrapper, but the original operation continues unless it supports cancellation independently.

### Sharing an AbortController

To cancel both the wrapper and the underlying operation, use the same `AbortController` for both:

```js
import { CancelablePromise } from '@straylightagency/cancelable-promise';

const controller = new AbortController();

const promise = fetch('https://api.example.com/users', {
    signal: controller.signal,
});

const operation = CancelablePromise.from(promise, controller);

operation
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    })
    .then(users => {
        console.log(users);
    })
    .catch(error => {
        if (error.name === 'AbortError') {
            console.log('Request canceled');
            return;
        }

        console.error(error);
    });

// Cancel the wrapper and the underlying request.
operation.cancel();
```

Because the wrapper and `fetch()` share the same controller, calling `cancel()` aborts the HTTP request and rejects the wrapped Promise.

You can also pass an existing controller to `makeCancelable()`:

```js
import { makeCancelable } from '@straylightagency/cancelable-promise';

const controller = new AbortController();

const promise = fetch('https://api.example.com/users', {
    signal: controller.signal,
});

const operation = makeCancelable(promise, controller);
```

The supplied controller must be used by the underlying operation if that operation is expected to stop when cancellation occurs.

## Chaining promises

`CancelablePromise` supports `then()`, `catch()`, and `finally()`, allowing you to chain operations in the same way as native Promises.

```js
import { CancelablePromise } from '@straylightagency/cancelable-promise';

const operation = new CancelablePromise(resolve => {
    setTimeout(() => resolve(2), 1000);
});

operation
    .then(value => value * 2)
    .then(value => value + 1)
    .then(result => {
        console.log(result); // 5
    })
    .catch(error => {
        console.error(error);
    })
    .finally(() => {
        console.log('Operation finished');
    });
```

Each method returns a `CancelablePromise` wrapping the resulting Promise.

The chained instances share the original cancellation controller. Calling `cancel()` on a pending instance therefore aborts the shared controller and affects the other instances that use it.

### Error handling

As with native Promises, errors thrown by fulfillment handlers reject the resulting Promise:

```js
operation
    .then(value => {
        throw new Error('Something went wrong');
    })
    .catch(error => {
        console.error(error.message);
    });
```

The `finally()` method runs a callback when the Promise settles, regardless of whether it fulfills or rejects.

The callback's return value does not replace the original result. However, if the callback throws an error or returns a rejected Promise, that error becomes the rejection reason.

Cancellation can reject a wrapped Promise before an asynchronous callback passed to `finally()` has completed. Do not rely on cancellation to wait for asynchronous cleanup.

## API reference

### `new CancelablePromise(executor)`

Creates a new cancelable promise.

| Parameter | Description |
| --- | --- |
| `executor` | Function receiving `(resolve, reject, signal)`. |

Returns a `CancelablePromise` instance.

### `cancel(reason?)`

Cancels a pending operation.

| Parameter | Description |
| --- | --- |
| `reason` | Optional error or message describing why the operation was canceled. Defaults to `"Operation canceled"`. |

Aborts the associated controller. The wrapped Promise is rejected with the supplied error or a `DOMException` named `AbortError`.

Calling `cancel()` after the instance has settled or has already been canceled has no effect.

### `then(onFulfilled?, onRejected?)`

Registers fulfillment and rejection handlers.

Returns a `CancelablePromise` wrapping the resulting Promise and sharing the original cancellation controller.

### `catch(onRejected?)`

Registers a rejection handler.

Returns a `CancelablePromise` wrapping the resulting Promise and sharing the original cancellation controller.

### `finally(onFinally?)`

Registers a callback to run when the Promise settles.

Returns a `CancelablePromise` wrapping the resulting Promise and sharing the original cancellation controller.

### `CancelablePromise.from(promise, controller?)`

Converts an existing Promise into a `CancelablePromise`.

| Parameter | Description |
| --- | --- |
| `promise` | The Promise to wrap. |
| `controller` | Optional `AbortController`. A new controller is created by default. |

The returned Promise can be rejected by cancellation even if the original Promise does not support cancellation.

The original Promise is still observed after cancellation, preventing a later rejection from becoming an unhandled rejection.

### `makeCancelable(promise, controller?)`

Converts an existing Promise into a `CancelablePromise`.

Accepts the same parameters and behaves like `CancelablePromise.from()`.

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `promise` | `Promise` | The Promise wrapped by the instance. |
| `isPending` | `boolean` | Indicates whether the wrapped Promise is pending. |
| `isCanceled` | `boolean` | Indicates whether the associated controller has been aborted. |
| `signal` | `AbortSignal` | Signal associated with the instance's cancellation controller. |

## Contributing

Contributions, bug reports, and feature requests are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test cancellation behavior, Promise chaining, and state transitions.
5. Submit a pull request.

Repository: https://github.com/straylightagency/js-cancelable-promise

Report issues: https://github.com/straylightagency/js-cancelable-promise/issues

## License

`@straylightagency/cancelable-promise` is released under the MIT License.

See the [LICENSE](LICENSE) file for details.