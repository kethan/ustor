import assert from "node:assert/strict";
import { batch, effect, store } from "../preact-setup.mjs";

const counter = store({
	count: 0,
	get double() { return this.count * 2; },
});

const seen = [];
const dispose = effect(() => seen.push(counter.double));

counter.count++;
assert.equal(counter.count, 1);
assert.equal(counter.double, 2);

batch(() => {
	counter.count = 3;
	counter.count = 4;
});
assert.deepEqual(seen, [0, 2, 8]);
assert.equal(counter.$count.value, 4);

dispose();
console.log("Counter example passed:", { count: counter.count, seen });
