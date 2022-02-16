import EventEmitter from "events";
import { BotEvents } from "mineflayer";

type Task = { done: boolean; promise: Promise<unknown>; cancel: CallableFunction; finish: CallableFunction };

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTask() {
    const task: Task = {
        done: false,
        promise: new Promise((resolve, reject) => {
            task.cancel = (err: Error) => {
                if (!task.done) {
                    task.done = true;
                    reject(err);
                }
            };
            task.finish = (result: any) => {
                if (!task.done) {
                    task.done = true;
                    resolve(result);
                }
            };
        }),
        cancel: () => {},
        finish: () => {},
    };
    return task;
}

export function createDoneTask() {
    const task = {
        done: true,
        promise: Promise.resolve(),
        cancel: () => {},
        finish: () => {},
    };
    return task;
}

/**
 * Similar to the 'once' function from the 'events' module, but allows you to add a condition for when you want to
 * actually handle the event, as well as a timeout. The listener is additionally removed if a timeout occurs, instead
 * of with 'once' where a listener might stay forever if it never triggers.
 * Note that timeout and checkCondition, both optional, are in the third parameter as an object.
 * @param emitter - The event emitter to listen to
 * @param event - The name of the event you want to listen for
 * @param [timeout=0] - An amount, in milliseconds, for which to wait before considering the promise failed. <0 = none.
 * @param [checkCondition] - A function which matches the same signature of an event emitter handler, and should return something truthy if you want the event to be handled. If this is not provided, all events are handled.
 * @returns {Promise} A promise which will either resolve to an *array* of values in the handled event, or will reject on timeout if applicable. This may never resolve if no timeout is set and the event does not fire.
 */
export function onceWithCleanup<K extends keyof BotEvents>(
    emitter: EventEmitter,
    event: K,
    { timeout = 0, checkCondition }: { timeout?: number; checkCondition?: (...args: Parameters<BotEvents[K]>) => boolean } = {}
): Promise<any> {
    const task = createTask();

    const onEvent = (data: Parameters<BotEvents[K]>) => {
        if (typeof checkCondition === "function" && !checkCondition(...data)) {
            return;
        }

        task.finish(data);
    };

    
    emitter.addListener(event, onEvent);

    if (typeof timeout === "number" && timeout > 0) {
        // For some reason, the call stack gets lost if we don't create the error outside of the .then call
        const timeoutError = new Error(`Event ${event} did not fire within timeout of ${timeout}ms`);
        sleep(timeout).then(() => {
            if (!task.done) {
                task.cancel(timeoutError);
            }
        });
    }

    task.promise.finally(() => emitter.removeListener(event, onEvent));

    return task.promise;
}

export function withTimeout(promise: Promise<unknown>, timeout: number) {
    return Promise.race([
        promise,
        sleep(timeout).then(() => {
            throw new Error("Promise timed out.");
        }),
    ]);
}
