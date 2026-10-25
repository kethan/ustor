import { beforeEach, describe, expect, it } from "vitest";
import { computed as preactMemo, signal as preactSignal } from "@preact/signals-core";
import { createMemo as solidMemo, createRoot as solidRoot, createSignal as solidSignal } from "solid-js/dist/solid";
import { isObservable as isObyObservable, memo as obyMemo, observable as obySignal } from "oby";
import { computed as sinuousMemo, observable as sinuousSignal } from "sinuous/observable";
import { computed as liveMemo, signal as liveSignal } from "ulive";
import { Signal as USignal, computed as uSignalMemo, signal as uSignal } from "usignal";
import { computed as vueMemo, effectScope as vueEffectScope, isRef as isVueRef, shallowRef as vueSignal } from "@vue/reactivity";
import { computed as alienMemo, isSignal as isAlienSignal, signal as alienSignal } from "alien-signals";
import S from "s-js";
import { computed as mobxMemo, isBoxedObservable as isMobxBox, observable as mobxObservable, runInAction as mobxAction } from "mobx";
import { BehaviorSubject } from "rxjs";
import { atom as nanoSignal } from "nanostores";
import { Store as TanStackStore, createStore as createTanStackStore } from "@tanstack/store";
import { Signal as WRSignal, computed as wrSignalMemo, signal as wrSignal } from "@webreflection/signal";
import { Signal as WRSignals, computed as wrSignalsMemo, signal as wrSignals } from "@webreflection/signals";
import { Signal as WRAlienSignal, computed as wrAlienMemo, signal as wrAlienSignal } from "@webreflection/alien-signals";
import { api, store } from "./src/index.js";

const valueAdapter = (signal, memo, is) => ({
	signal,
	memo,
	is,
	get: (value) => value.value,
	getMemo: (value) => value.value,
	set: (target, value) => { target.value = value; },
});

const callableAdapter = (signal, memo, is) => ({
	signal,
	memo,
	is,
	get: (value) => value(),
	getMemo: (value) => value(),
	set: (target, value) => target(value),
});

const sSignals = new WeakSet();
const adapters = [
	{
		name: "Preact Signals",
		adapter: valueAdapter(preactSignal, preactMemo, (value) => typeof value?.peek === "function"),
	},
	{
		name: "Solid.js",
		adapter: {
			signal: solidSignal,
			memo: solidMemo,
			getMemo: (value) => value(),
			is: (value) => Array.isArray(value) && typeof value[0] === "function" && typeof value[1] === "function",
			get: (value) => value[0](),
			set: (target, value) => target[1](value),
		},
		scope: (fn) => solidRoot((dispose) => { try { fn(); } finally { dispose(); } }),
	},
	{
		name: "Oby",
		adapter: callableAdapter(obySignal, obyMemo, isObyObservable),
	},
	{
		name: "Sinuous",
		adapter: callableAdapter(sinuousSignal, sinuousMemo, (value) => !!value?.$o),
	},
	{
		name: "ulive",
		adapter: valueAdapter(liveSignal, liveMemo, (value) => typeof value?.peek === "function"),
	},
	{
		name: "usignal",
		adapter: valueAdapter(uSignal, uSignalMemo, (value) => value instanceof USignal),
	},
	{
		name: "Vue reactivity",
		adapter: valueAdapter(vueSignal, vueMemo, isVueRef),
		scope: (fn) => {
			const scope = vueEffectScope();
			try { scope.run(fn); } finally { scope.stop(); }
		},
	},
	{
		name: "alien-signals",
		adapter: callableAdapter(alienSignal, alienMemo, (value) => typeof value === "function" && isAlienSignal(value)),
	},
	{
		name: "S.js",
		adapter: callableAdapter(
			(value) => {
				const signal = S.data(value);
				sSignals.add(signal);
				return signal;
			},
			(fn) => S(fn),
			(value) => sSignals.has(value),
		),
		scope: (fn) => S.root((dispose) => { try { fn(); } finally { dispose(); } }),
	},
	{
		name: "MobX",
		adapter: {
			signal: (value) => mobxObservable.box(value, { deep: false }),
			memo: mobxMemo,
			getMemo: (value) => value.get(),
			is: isMobxBox,
			get: (value) => value.get(),
			set: (target, value) => mobxAction(() => target.set(value)),
		},
	},
	{
		name: "RxJS BehaviorSubject (basic)",
		adapter: {
			signal: (value) => new BehaviorSubject(value),
			is: (value) => value instanceof BehaviorSubject,
			get: (value) => value.getValue(),
			set: (target, value) => target.next(value),
		},
	},
	{
		name: "Nanostores (basic)",
		adapter: {
			signal: nanoSignal,
			is: (value) => typeof value?.get === "function" && typeof value?.set === "function" && typeof value?.listen === "function",
			get: (value) => value.get(),
			set: (target, value) => target.set(value),
		},
	},
	{
		name: "TanStack Store",
		adapter: {
			signal: (value) => new TanStackStore([value]),
			memo: (fn) => createTanStackStore(fn),
			getMemo: (value) => value.state,
			is: (value) => value instanceof TanStackStore,
			get: (value) => value.state[0],
			set: (target, value) => target.setState(() => [value]),
		},
	},
	{
		name: "@webreflection/signal",
		adapter: valueAdapter(wrSignal, wrSignalMemo, (value) => value instanceof WRSignal),
	},
	{
		name: "@webreflection/signals",
		adapter: valueAdapter(wrSignals, wrSignalsMemo, (value) => value instanceof WRSignals),
	},
	{
		name: "@webreflection/alien-signals",
		adapter: valueAdapter(wrAlienSignal, wrAlienMemo, (value) => value instanceof WRAlienSignal),
	},
];

describe.each(adapters)("$name adapter", ({ adapter, scope }) => {
	beforeEach(() => {
		for (const key of Object.keys(api)) delete api[key];
		Object.assign(api, adapter);
	});

	const adapterIt = (name, fn) => it(name, () => scope ? scope(fn) : fn());

	adapterIt("preserves values, existing signals, functions, and nested updates", () => {
		const external = api.signal(1);
		const state = store({ a: external, nested: { value: 2 }, fn: () => 7 });
		expect(state.a).toBe(1);
		expect(state.$a).toBe(external);
		expect(state.fn()).toBe(7);
		state.a = 3;
		state.nested.value = 4;
		expect(api.get(external)).toBe(3);
		expect(state.nested.value).toBe(4);
	});

	adapterIt("supports direct getters without the optional memo adapter", () => {
		delete api.memo;
		delete api.getMemo;
		const state = store({ a: 2, b: 3, get sum() { return this.a + this.b; } });
		expect(state.sum).toBe(5);
		state.a = 5;
		expect(state.sum).toBe(8);
		expect("$sum" in state).toBe(false);
	});

	adapterIt("tracks array replacement, mutation, and inserted objects", () => {
		const state = store({
			list: [1, 2, { value: 3 }],
			get total() {
				return this.list.reduce((sum, item) => sum + (item?.value ?? item), 0);
			},
		});
		expect(state.total).toBe(6);
		state.list.push({ value: 4 });
		expect(state.total).toBe(10);
		state.list[0] = 5;
		expect(state.total).toBe(14);
		state.list[2].value = 4;
		expect(state.total).toBe(15);
		state.list = [2, 3];
		expect(state.total).toBe(5);
	});

	if (adapter.memo) {
		adapterIt("supports primitive getter values with automatic memoization", () => {
			const state = store({ a: 2, b: 3, get sum() { return this.a + this.b; } });
			expect(state.sum).toBe(5);
			expect(api.getMemo(state.$sum)).toBe(5);
			state.a = 5;
			expect(state.sum).toBe(8);
			expect(api.getMemo(state.$sum)).toBe(8);
		});

		adapterIt("updates conditional memo dependencies", () => {
			const state = store({
				chooseLeft: true,
				left: 1,
				right: 2,
				get selected() { return this.chooseLeft ? this.left : this.right; },
			});
			expect(state.selected).toBe(1);
			state.chooseLeft = false;
			expect(state.selected).toBe(2);
			state.left = 3;
			expect(state.selected).toBe(2);
			state.right = 4;
			expect(state.selected).toBe(4);
		});
	}
});
