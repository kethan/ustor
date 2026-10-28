import assert from "node:assert/strict";
import { BehaviorSubject } from "rxjs";
import { api, store } from "ustor";

// RxJS is a basic adapter: getters are evaluated on access. Automatic computed values
// require explicit dependency lists and are intentionally not configured.
Object.assign(api, {
	signal: (value) => new BehaviorSubject(value),
	get: (subject) => subject.getValue(),
	set: (subject, value) => subject.next(value),
	is: (value) => value instanceof BehaviorSubject,
});

const counter = store({
	count: 1,
	get double() { return this.count * 2; },
});

const seen = [];
const subscription = counter.$count.subscribe((value) => seen.push(value));
counter.count = 2;
assert.equal(counter.double, 4);
assert.deepEqual(seen, [1, 2]);

subscription.unsubscribe();
counter.count = 3;
assert.deepEqual(seen, [1, 2]);
assert.equal(counter.double, 6);

console.log("RxJS basic adapter example passed:", { count: counter.count, seen });
