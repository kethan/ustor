import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { batch, computed, effect, signal } from "@preact/signals-core";
import { api, is, store } from "./src/index.js";

let disposers = [];

const configure = (overrides = {}) => {
	for (const key of Object.keys(api)) delete api[key];
	Object.assign(api, {
		signal,
		get: (value) => value?.value,
		set: (target, value) => { target.value = value; },
		is: (value) => typeof value?.peek === "function",
		...overrides,
	});
};

const observe = (fn) => {
	const dispose = effect(fn);
	disposers.push(dispose);
	return dispose;
};

beforeEach(() => {
	disposers = [];
	configure();
});

afterEach(() => {
	for (const dispose of disposers) dispose();
});

describe("store fundamentals", () => {
	it("reads and writes values and exposes their signals", () => {
		const external = signal(1);
		const state = store({ a: external, b: 2 });

		expect(state.a).toBe(1);
		expect(state.$a).toBe(external);
		expect(state.b).toBe(2);
		expect(api.is(state.$b)).toBe(true);
		expect(state.$b.value).toBe(2);
		expect(Object.prototype.propertyIsEnumerable.call(state, "$b")).toBe(false);

		state.a = 3;
		state.$b.value = 4;
		expect(external.value).toBe(3);
		expect(state.a).toBe(3);
		expect(state.b).toBe(4);
	});

	it("is idempotent for stores and cached raw inputs", () => {
		const raw = { value: 1 };
		const state = store(raw);
		expect(store(state)).toBe(state);
		expect(store(raw)).toBe(state);

		const rawList = [1];
		const list = store(rawList);
		expect(store(list)).toBe(list);
		expect(store(rawList)).toBe(list);
	});

	it("recognizes stores and descendants with a boolean result", () => {
		const state = store({ a: 1 });
		const descendant = Object.create(state);
		expect(is(state)).toBe(true);
		expect(is(descendant)).toBe(true);
		expect(store(descendant)).toBe(descendant);
		expect(is({})).toBe(false);
		expect(is(null)).toBe(false);
		expect(is(undefined)).toBe(false);
		expect(is(1)).toBe(false);
	});

	it("returns primitives, including nullish values, unchanged", () => {
		const symbol = Symbol("primitive");
		expect(store(null)).toBeNull();
		expect(store(undefined)).toBeUndefined();
		expect(store(0)).toBe(0);
		expect(store("value")).toBe("value");
		expect(store(false)).toBe(false);
		expect(store(10n)).toBe(10n);
		expect(store(symbol)).toBe(symbol);
	});

	it("fails loudly when an object store is created without an adapter", () => {
		for (const key of Object.keys(api)) delete api[key];
		expect(() => store({ a: 1 })).toThrow(/configure api\.signal/);
		expect(() => store([])).toThrow(/configure api\.signal/);
		expect(store(null)).toBeNull();
		expect(store(1)).toBe(1);
	});

	it("supports objects with constructor data properties", () => {
		const state = store({ constructor: "data", value: 1 });
		expect(state.constructor).toBe("data");
		expect(state.value).toBe(1);
		state.value = 2;
		expect(state.value).toBe(2);
	});

	it("supports null-prototype objects and explicit prototypes", () => {
		const raw = Object.create(null);
		raw.value = 1;
		const nullPrototypeState = store(raw);
		expect(Object.getPrototypeOf(nullPrototypeState)).toBeNull();
		expect(nullPrototypeState.value).toBe(1);

		const proto = { double() { return this.value * 2; } };
		const customRaw = Object.create(proto);
		customRaw.value = 2;
		const inherited = store(customRaw);
		expect(Object.getPrototypeOf(inherited)).toBe(proto);
		expect(inherited.double()).toBe(4);

		const explicit = store({ value: 3 }, proto);
		expect(explicit.double()).toBe(6);
		const explicitNull = store({ value: 3 }, null);
		expect(Object.getPrototypeOf(explicitNull)).toBeNull();
	});

	it("treats class instances and built-in objects as atomic values", () => {
		class Box { constructor() { this.value = 1; } }
		const box = new Box();
		const date = new Date();
		const map = new Map();
		expect(store(box)).toBe(box);
		expect(store(date)).toBe(date);
		expect(store(map)).toBe(map);
		const state = store({ box });
		expect(state.box).toBe(box);
	});

	it("preserves shared references and object cycles", () => {
		const shared = { value: 1 };
		const raw = { left: shared, right: shared };
		raw.self = raw;
		const state = store(raw);
		expect(state.left).toBe(state.right);
		expect(state.self).toBe(state);
		state.left.value = 2;
		expect(state.right.value).toBe(2);
	});

	it("uses a sealed object schema instead of allowing untracked additions", () => {
		const state = store({ nested: { value: 1 } });
		expect(Object.isSealed(state)).toBe(true);
		expect(Object.isSealed(state.nested)).toBe(true);
		expect(() => { state.added = 2; }).toThrow(TypeError);
		expect(() => { delete state.nested; }).toThrow(TypeError);
	});
});

describe("property descriptors and keys", () => {
	it("supports symbol keys and preserves enumerability", () => {
		const key = Symbol("value");
		const raw = { visible: 1, [key]: 2 };
		Object.defineProperty(raw, "hidden", { value: 3, writable: true, enumerable: false });
		const state = store(raw);

		expect(state[key]).toBe(2);
		expect(state.hidden).toBe(3);
		expect(Object.keys(state)).toEqual(["visible"]);
		expect(Reflect.ownKeys(state)).toContain(key);
		expect(Object.prototype.propertyIsEnumerable.call(state, "hidden")).toBe(false);
		state[key] = 4;
		state.hidden = 5;
		expect(state[key]).toBe(4);
		expect(state.hidden).toBe(5);
	});

	it("respects non-writable data properties", () => {
		const raw = {};
		Object.defineProperty(raw, "value", {
			value: 1,
			writable: false,
			enumerable: true,
		});
		const state = store(raw);
		expect(state.value).toBe(1);
		expect(() => { state.value = 2; }).toThrow(TypeError);
	});

	it("allows explicit dollar-prefixed keys to take precedence over aliases", () => {
		const state = store({ a: 1, $a: 2 });
		expect(state.a).toBe(1);
		expect(state.$a).toBe(2);
		state.a = 3;
		state.$a = 4;
		expect(state.a).toBe(3);
		expect(state.$a).toBe(4);
	});

	it("supports getter-only and setter-only accessors", () => {
		let value = 1;
		const state = store({
			get readOnly() { return value; },
			set writeOnly(next) { value = next; },
		});
		expect(state.readOnly).toBe(1);
		expect(state.writeOnly).toBeUndefined();
		expect("$readOnly" in state).toBe(false);
		expect("$writeOnly" in state).toBe(false);
		expect(() => { state.readOnly = 2; }).toThrow(TypeError);
		state.writeOnly = 3;
		expect(value).toBe(3);
		expect(state.readOnly).toBe(3);
	});
});

describe("derived properties", () => {
	it("returns fresh primitive getter values without a memo adapter", () => {
		const state = store({
			get sum() { return this.a + this.b; },
			a: 2,
			b: 3,
		});
		expect(state.sum).toBe(5);
		expect("$sum" in state).toBe(false);
		state.a = 5;
		expect(state.sum).toBe(8);
	});

	it("tracks direct getters inside effects", () => {
		const state = store({ a: 2, b: 3, get sum() { return this.a + this.b; } });
		const seen = [];
		observe(() => seen.push(state.sum));
		state.a = 5;
		expect(seen).toEqual([5, 8]);
	});

	it("uses the regular getter adapter for memos when getMemo is omitted", () => {
		configure({ memo: computed });
		const state = store({ a: 2, b: 3, get sum() { return this.a + this.b; } });
		expect(state.sum).toBe(5);
		state.a = 4;
		expect(state.sum).toBe(7);
	});

	it("unwraps memoized getters and exposes the memo through $", () => {
		configure({ memo: computed, getMemo: (value) => value.value });
		let calls = 0;
		const state = store({
			get sum() { calls++; return this.a + this.b; },
			a: 2,
			b: 3,
		});
		expect(state.sum).toBe(5);
		expect(state.sum).toBe(5);
		expect(calls).toBe(1);
		expect(state.$sum).toBe(state.$sum);
		expect(api.get(state.$sum)).toBe(5);
		state.a = 5;
		expect(state.sum).toBe(8);
		expect(calls).toBe(2);
	});

	it("binds getter and setter accessors to the reactive state", () => {
		const state = store({
			x: 1,
			y: 2,
			get xy() { return this.x + this.y; },
			set xy([x, y]) { this.x = x; this.y = y; },
		});
		expect(state.xy).toBe(3);
		state.xy = [4, 5];
		expect([state.x, state.y, state.xy]).toEqual([4, 5, 9]);
	});
});

describe("nested objects and arrays", () => {
	it("tracks nested updates and object replacement", () => {
		const state = store({ nested: { value: 1 } });
		const doubled = computed(() => state.nested.value * 2);
		expect(doubled.value).toBe(2);
		state.nested.value = 3;
		expect(doubled.value).toBe(6);
		state.nested = { value: 4 };
		expect(doubled.value).toBe(8);
	});

	it("tracks in-place array index writes while retaining the input target", () => {
		const input = [1, 2, 3];
		const state = store({ list: input });
		const total = computed(() => state.list.reduce((sum, value) => sum + value, 0));
		expect(total.value).toBe(6);
		state.list[1] = 20;
		expect(total.value).toBe(24);
		expect(input).toEqual([1, 20, 3]);
		state.list = [2, 3];
		expect(total.value).toBe(5);
	});

	it.each([
		{ initial: [1, 2, 3], method: "push", args: [4], expected: [1, 2, 3, 4] },
		{ initial: [1, 2, 3], method: "pop", args: [], expected: [1, 2] },
		{ initial: [1, 2, 3], method: "shift", args: [], expected: [2, 3] },
		{ initial: [1, 2, 3], method: "unshift", args: [0], expected: [0, 1, 2, 3] },
		{ initial: [1, 2, 3], method: "splice", args: [1, 1, 8, 9], expected: [1, 8, 9, 3] },
		{ initial: [1, 2, 3], method: "reverse", args: [], expected: [3, 2, 1] },
		{ initial: [3, 1, 2], method: "sort", args: [], expected: [1, 2, 3] },
		{ initial: [1, 2, 3], method: "fill", args: [9, 1], expected: [1, 9, 9] },
		{ initial: [1, 2, 3], method: "copyWithin", args: [1, 0, 2], expected: [1, 1, 2] },
	])("$method() updates values and computed dependencies", ({ initial, method, args, expected }) => {
		const state = store({ list: initial });
		const total = computed(() => state.list.reduce((sum, value) => sum + value, 0));
		state.list[method](...args);
		expect([...state.list]).toEqual(expected);
		expect(total.value).toBe(expected.reduce((sum, value) => sum + value, 0));
	});

	it("coalesces each mutating array method into one final notification", () => {
		const state = store({ list: [1, 2, 3] });
		const seen = [];
		observe(() => seen.push(state.list.reduce((sum, value) => sum + value, 0)));
		state.list.pop();
		expect(seen).toEqual([6, 3]);
		state.list.push(4);
		expect(seen).toEqual([6, 3, 7]);
	});

	it("does not notify for no-op writes or empty mutations", () => {
		const state = store({ list: [1] });
		let runs = 0;
		observe(() => { runs++; state.list[0]; });
		state.list[0] = 1;
		expect(runs).toBe(1);
		state.list[0] = 2;
		expect(runs).toBe(2);

		const empty = store([]);
		let emptyRuns = 0;
		observe(() => { emptyRuns++; empty.length; });
		empty.pop();
		expect(emptyRuns).toBe(1);
	});

	it("tracks length changes, deletion, key enumeration, and membership", () => {
		const state = store({ list: [1, 2, 3] });
		const total = computed(() => state.list.reduce((sum, value) => sum + value, 0));
		const keys = computed(() => Object.keys(state.list).join(","));
		const hasThird = computed(() => 2 in state.list);
		expect([total.value, keys.value, hasThird.value]).toEqual([6, "0,1,2", true]);

		state.list.length = 1;
		expect([total.value, keys.value, hasThird.value]).toEqual([1, "0", false]);
		delete state.list[0];
		expect(total.value).toBe(0);
		expect(0 in state.list).toBe(false);
		state.list.push(4, 5);
		expect(keys.value).toBe("1,2");
		expect(total.value).toBe(9);
	});

	it("handles absent, non-extensible, and non-configurable array keys safely", () => {
		const input = [1];
		const state = store(input);
		let runs = 0;
		observe(() => { runs++; Object.keys(state); });
		expect(Reflect.deleteProperty(state, 10)).toBe(true);
		expect(runs).toBe(1);

		Object.defineProperty(input, "0", { configurable: false });
		expect(() => { delete state[0]; }).toThrow(TypeError);

		const sealedInput = [1];
		const sealed = store(sealedInput);
		Object.preventExtensions(sealedInput);
		expect(() => { sealed[1] = 2; }).toThrow(TypeError);
		expect(sealed).toHaveLength(1);
	});

	it("supports nullish entries and wraps objects inserted into arrays", () => {
		const state = store({ list: [null, undefined, { value: 1 }] });
		const total = computed(() => state.list.reduce((sum, item) => sum + (item?.value ?? 0), 0));
		expect(total.value).toBe(1);
		state.list.push({ value: 2 });
		expect(is(state.list[3])).toBe(true);
		expect(total.value).toBe(3);
		state.list[3].value = 4;
		expect(total.value).toBe(5);
		state.list[0] = { value: 1 };
		expect(is(state.list[0])).toBe(true);
		expect(total.value).toBe(6);
	});

	it("preserves sparse arrays, array cycles, and shared arrays", () => {
		const sparse = new Array(2);
		sparse[1] = 2;
		const sparseState = store(sparse);
		expect(0 in sparseState).toBe(false);
		expect(sparseState.length).toBe(2);

		const cyclic = [];
		cyclic.push(cyclic);
		const cyclicState = store(cyclic);
		expect(cyclicState[0]).toBe(cyclicState);

		const shared = [1];
		const state = store({ left: shared, right: shared });
		expect(state.left).toBe(state.right);
	});

	it("matches native arrays across deterministic randomized mutation sequences", () => {
		for (let seed = 1; seed <= 10; seed++) {
			let randomState = seed;
			const random = () => {
				randomState = (randomState * 1664525 + 1013904223) >>> 0;
				return randomState / 2 ** 32;
			};
			const integer = (limit) => Math.floor(random() * limit);
			const model = [1, 2, 3];
			const state = store({ list: [1, 2, 3] });
			const total = computed(() => state.list.reduce((sum, value) => sum + value, 0));

			for (let step = 0; step < 100; step++) {
				const operation = integer(12);
				const index = state.list.length ? integer(state.list.length) : 0;
				const value = integer(20) - 10;
				let actual;
				let expected;
				if (operation === 0) {
					state.list[index] = value;
					model[index] = value;
				} else if (operation === 7) {
					expect(delete state.list[index]).toBe(true);
					expect(delete model[index]).toBe(true);
				} else if (operation === 6) {
					const length = integer(7);
					state.list.length = length;
					model.length = length;
				} else {
					const methods = ["push", "pop", "shift", "unshift", "splice", null, null, "reverse", "sort", "fill", "copyWithin"];
					const method = methods[operation - 1];
					let args = [];
					if (method === "push" || method === "unshift") args = [value];
					if (method === "splice") args = [index, integer(3), value];
					if (method === "fill") args = [value, index, index + integer(2)];
					if (method === "copyWithin") args = [index, integer(state.list.length + 1)];
					actual = state.list[method](...args);
					expected = model[method](...args);
					expect(actual).toEqual(expected);
				}
				const context = `seed ${seed}, step ${step}, operation ${operation}`;
				expect([...state.list], context).toEqual([...model]);
				expect(Object.keys(state.list), context).toEqual(Object.keys(model));
				expect(total.value, context).toBe(model.reduce((sum, value) => sum + value, 0));
			}
		}
	});

	it("handles deep nesting and batched updates", () => {
		let deep = { value: 1 };
		for (let i = 0; i < 50; i++) deep = { nested: deep };
		const state = store({ deep, a: 1, b: 2 });
		let cursor = state.deep;
		for (let i = 0; i < 50; i++) cursor = cursor.nested;
		cursor.value = 50;
		expect(cursor.value).toBe(50);

		let computations = 0;
		const sum = computed(() => {
			computations++;
			return state.a + state.b;
		});
		expect(sum.value).toBe(3);
		batch(() => {
			for (let i = 0; i < 1000; i++) {
				state.a = i;
				state.b = i + 1;
			}
		});
		expect(sum.value).toBe(1999);
		expect(computations).toBe(2);
	});
});
